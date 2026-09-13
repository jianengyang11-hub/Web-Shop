import { useState, type ReactNode } from "react";
import { ApiError, createTenant, login, recoverPin } from "../api/client";
import { getToken } from "../auth";
import { getTenantId } from "../tenant";
import RecoveryCodeNotice from "./RecoveryCodeNotice";

type Mode = "login" | "create" | "recover";

/** PIN-based login as the first screen. No rate-limiting yet on any of these forms — see
 * docs/ARCHITECTURE.md for current limits. "Forgot PIN" recovers via a one-time backup code
 * instead of email/SMS (see RecoveryCodeNotice for where that code first appears). */
export default function AuthGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(!!(getTenantId() && getToken()));
  const [mode, setMode] = useState<Mode>("login");
  const [shopId, setShopId] = useState("");
  const [shopName, setShopName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Set once a "New Shop" or "recover" call succeeds, so the code can be shown before the user
  // moves on — never re-shown after this screen.
  const [pendingRecoveryCode, setPendingRecoveryCode] = useState<string | null>(null);
  const [recoveredShopId, setRecoveredShopId] = useState<string | null>(null);

  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPin, setNewPin] = useState("");

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
      setPendingRecoveryCode(tenant.recoveryCode);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create shop");
    } finally {
      setBusy(false);
    }
  }

  async function handleRecover(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!recoveryCode.trim() || newPin.trim().length < 4) {
      setError("กรอกรหัสกู้คืนและ PIN ใหม่อย่างน้อย 4 หลัก");
      return;
    }
    setBusy(true);
    try {
      const result = await recoverPin(recoveryCode.trim(), newPin.trim());
      setRecoveredShopId(result.tenantId);
      setPendingRecoveryCode(result.newRecoveryCode);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "รหัสกู้คืนไม่ถูกต้อง");
    } finally {
      setBusy(false);
    }
  }

  if (pendingRecoveryCode) {
    // Login already succeeded (New Shop) or the PIN was already reset (recover) — this screen
    // exists purely to show the one-time code before moving on.
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h1 className="text-lg font-bold text-gray-900">
            {recoveredShopId ? "ตั้ง PIN ใหม่สำเร็จ" : "สร้างร้านสำเร็จ"}
          </h1>
          {recoveredShopId && (
            <p className="text-sm text-gray-600">
              Shop ID ของคุณคือ <span className="font-mono font-semibold">{recoveredShopId}</span>
            </p>
          )}
          <RecoveryCodeNotice code={pendingRecoveryCode} label="รหัสกู้คืนบัญชี (Recovery Code)" />
          <button
            onClick={() => {
              if (recoveredShopId) {
                setShopId(recoveredShopId);
                setMode("login");
                setPendingRecoveryCode(null);
                setRecoveredShopId(null);
              } else {
                setAuthed(true);
              }
            }}
            className="w-full bg-gray-900 text-white rounded-lg py-2.5 font-medium"
          >
            {recoveredShopId ? "ไปหน้าเข้าสู่ระบบ" : "ไปที่ Dashboard"}
          </button>
        </div>
      </div>
    );
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
            <button
              type="button"
              onClick={() => {
                setMode("recover");
                setError(null);
              }}
              className="w-full text-xs text-gray-500 underline"
            >
              ลืม PIN?
            </button>
          </form>
        ) : mode === "create" ? (
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
        ) : (
          <form onSubmit={handleRecover} className="space-y-3">
            <p className="text-xs text-gray-500">
              กรอกรหัสกู้คืนบัญชี (Recovery Code) ที่ได้รับตอนสร้างร้าน/เพิ่มพนักงาน แล้วตั้ง PIN ใหม่ — ไม่ต้องใช้ Shop ID
            </p>
            <input
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value)}
              placeholder="Recovery Code เช่น ABCDE-12345"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="PIN ใหม่ (4 หลักขึ้นไป)"
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
              ตั้ง PIN ใหม่
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className="w-full text-xs text-gray-500 underline"
            >
              กลับไปหน้าเข้าสู่ระบบ
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
