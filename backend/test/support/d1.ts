/**
 * A tiny D1-shaped wrapper around a REAL embedded SQLite engine (sql.js — pure WASM, plain
 * `npm install`, no native compile step, no admin rights needed — chosen after two prior
 * environment failures in this sandbox with Postgres/Java). Since D1 *is* SQLite, this exercises
 * the same atomic-conditional-UPDATE and batch-as-transaction semantics the production code
 * relies on, not a rubber-stamp mock.
 *
 * All access is serialized through a mutex, matching real D1/SQLite's single-writer model — two
 * "concurrent" async callers (e.g. two confirmOrder calls racing via Promise.all) genuinely
 * interleave at the JS/await level, but their actual SQL statements never interleave with each
 * other, so a batch()'s BEGIN...COMMIT is never split by another caller's statement.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";

let sqlJsPromise: ReturnType<typeof initSqlJs> | null = null;

function loadSqlJs() {
  if (!sqlJsPromise) {
    const require = createRequire(import.meta.url);
    const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
    const wasmBinary = readFileSync(wasmPath);
    sqlJsPromise = initSqlJs({ wasmBinary });
  }
  return sqlJsPromise;
}

class Mutex {
  private queue: Promise<unknown> = Promise.resolve();

  run<T>(fn: () => T): Promise<T> {
    const result = this.queue.then(fn, fn);
    this.queue = result.then(
      () => undefined,
      () => undefined
    );
    return result as Promise<T>;
  }
}

interface D1LikeResult<T = Record<string, unknown>> {
  results: T[];
  success: true;
  meta: { changes: number };
}

class FakeStatement {
  constructor(
    private db: SqlJsDatabase,
    private mutex: Mutex,
    private sql: string,
    private params: unknown[] = []
  ) {}

  bind(...params: unknown[]): FakeStatement {
    return new FakeStatement(this.db, this.mutex, this.sql, params);
  }

  /** Runs without acquiring the mutex — only safe when the caller (batch()) already holds it. */
  _runRaw(): D1LikeResult {
    this.db.run(this.sql, this.params as never);
    return { results: [], success: true, meta: { changes: this.db.getRowsModified() } };
  }

  async run(): Promise<D1LikeResult> {
    return this.mutex.run(() => this._runRaw());
  }

  async all<T = Record<string, unknown>>(): Promise<D1LikeResult<T>> {
    return this.mutex.run(() => {
      const stmt = this.db.prepare(this.sql);
      stmt.bind(this.params as never);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      stmt.free();
      return { results: rows, success: true, meta: { changes: 0 } };
    });
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const { results } = await this.all<T>();
    return results[0] ?? null;
  }
}

class FakeD1Database {
  private mutex = new Mutex();

  constructor(private db: SqlJsDatabase) {}

  prepare(sql: string): FakeStatement {
    return new FakeStatement(this.db, this.mutex, sql);
  }

  async batch(statements: FakeStatement[]): Promise<D1LikeResult[]> {
    return this.mutex.run(() => {
      this.db.run("BEGIN");
      try {
        const results = statements.map((stmt) => stmt._runRaw());
        this.db.run("COMMIT");
        return results;
      } catch (err) {
        this.db.run("ROLLBACK");
        throw err;
      }
    });
  }
}

export async function createTestD1(migrationSql: string): Promise<D1Database> {
  const SQL = await loadSqlJs();
  const sqlJsDb = new SQL.Database();
  sqlJsDb.run(migrationSql);
  return new FakeD1Database(sqlJsDb) as unknown as D1Database;
}
