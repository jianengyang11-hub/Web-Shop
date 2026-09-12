import { useState, type ReactNode } from "react";
import { createTenant, fetchTenant } from "../api/client";
import { getTenantId, setTenantId } from "../tenant";

/** No login system yet (see docs/ARCHITECTURE.md) — this is a placeholder that lets a shop
 * identify itself by a tenant id (persisted to localStorage) before the dashboard loads, or
 * create a brand-new shop. Real auth can replace this gate later without touching any page. */
export default function TenantGate({ children }: { children: ReactNode }) {
  const [tenantId, setTenantIdState] = useState<string | null>(getTenantId());
  const [mode, setMode] = useState<"join" | "create">("join");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (tenantId) return <>{children}</>;

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const tenant = await fetchTenant(input.trim());
      if (!tenant) {
        setError("Shop ID not found");
        return;
      }
      setTenantId(tenant.id);
      setTenantIdState(tenant.id);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const tenant = await createTenant(input.trim());
      setTenantId(tenant.id);
      setTenantIdState(tenant.id);
    } catch {
      setError("Could not create shop");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h1 className="text-lg font-bold text-gray-900">Shop Owner Dashboard</h1>

        <div className="flex gap-2 text-sm">
          <button
            onClick={() => {
              setMode("join");
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2 font-medium ${mode === "join" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            Enter Shop ID
          </button>
          <button
            onClick={() => {
              setMode("create");
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2 font-medium ${mode === "create" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            New Shop
          </button>
        </div>

        <form onSubmit={mode === "join" ? handleJoin : handleCreate} className="space-y-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "join" ? "Shop ID" : "Shop name"}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-gray-900 text-white rounded-lg py-2.5 font-medium disabled:opacity-50"
          >
            {mode === "join" ? "Continue" : "Create Shop"}
          </button>
        </form>
      </div>
    </div>
  );
}
