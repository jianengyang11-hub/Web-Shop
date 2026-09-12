import { useState, type ReactNode } from "react";
import { ApiError, createTenant, login } from "../api/client";
import { getToken } from "../auth";
import { getTenantId } from "../tenant";

/** PIN-based login as the first screen. No self-service password reset / rate-limiting yet —
 * see docs/ARCHITECTURE.md for current limits. */
export default function AuthGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(!!(getTenantId() && getToken()));
  const [mode, setMode] = useState<"login" | "create">("login");
  const [shopId, setShopId] = useState("");
  const [shopName, setShopName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (authed) return <>{children}</>;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!shopId.trim() || !pin.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await login(shopId.trim(), pin.trim());
      setAuthed(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!shopName.trim() || pin.trim().length < 4) {
      setError("PIN must be at least 4 digits");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const tenant = await createTenant(shopName.trim(), pin.trim());
      await login(tenant.id, pin.trim());
      setAuthed(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create shop");
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
              setMode("login");
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2 font-medium ${mode === "login" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            Log In
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

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
              placeholder="Shop ID"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="PIN"
              type="password"
              inputMode="numeric"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-gray-900 text-white rounded-lg py-2.5 font-medium disabled:opacity-50"
            >
              Log In
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Shop name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Choose a PIN (4+ digits)"
              type="password"
              inputMode="numeric"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-gray-900 text-white rounded-lg py-2.5 font-medium disabled:opacity-50"
            >
              Create Shop
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
