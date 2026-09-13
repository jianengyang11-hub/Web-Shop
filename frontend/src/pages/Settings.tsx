import { useEffect, useState } from "react";
import { ApiError, api, changePin, createTenant } from "../api/client";
import { getTenantId } from "../tenant";

interface IntegrationSettings {
  whatsappPhoneNumberId: string | null;
  whatsappAccessToken: string | null;
  messengerPageId: string | null;
  messengerAccessToken: string | null;
}

const EMPTY: IntegrationSettings = {
  whatsappPhoneNumberId: "",
  whatsappAccessToken: "",
  messengerPageId: "",
  messengerAccessToken: "",
};

export default function Settings() {
  const [form, setForm] = useState<IntegrationSettings>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<IntegrationSettings>("/settings/integrations")
      .then((data) =>
        setForm({
          whatsappPhoneNumberId: data.whatsappPhoneNumberId ?? "",
          whatsappAccessToken: data.whatsappAccessToken ?? "",
          messengerPageId: data.messengerPageId ?? "",
          messengerAccessToken: data.messengerAccessToken ?? "",
        })
      )
      .catch((e) => setError(e.message));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api.put("/settings/integrations", form);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save settings");
    } finally {
      setBusy(false);
    }
  }

  function field(key: keyof IntegrationSettings, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Settings</h1>

      <form onSubmit={save} className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900 mb-2">WhatsApp</h2>
          <div className="space-y-2">
            <label className="block text-xs text-gray-500">
              Phone Number ID
              <input
                value={form.whatsappPhoneNumberId ?? ""}
                onChange={(e) => field("whatsappPhoneNumberId", e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
            </label>
            <label className="block text-xs text-gray-500">
              Access Token
              <input
                value={form.whatsappAccessToken ?? ""}
                onChange={(e) => field("whatsappAccessToken", e.target.value)}
                type="password"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
            </label>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h2 className="font-semibold text-gray-900 mb-2">Facebook Messenger</h2>
          <div className="space-y-2">
            <label className="block text-xs text-gray-500">
              Page ID
              <input
                value={form.messengerPageId ?? ""}
                onChange={(e) => field("messengerPageId", e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
            </label>
            <label className="block text-xs text-gray-500">
              Access Token
              <input
                value={form.messengerAccessToken ?? ""}
                onChange={(e) => field("messengerAccessToken", e.target.value)}
                type="password"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
            </label>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">Saved.</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-gray-900 text-white rounded-lg py-2.5 font-medium disabled:opacity-50"
        >
          Save
        </button>
      </form>

      <NewShopForm />
      <ChangePinForm />
    </div>
  );
}

function NewShopForm() {
  const [name, setName] = useState("");
  const [shopId, setShopId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!name.trim() || pin.trim().length < 4) {
      setError("กรุณากรอกชื่อร้านและ PIN อย่างน้อย 4 หลัก");
      return;
    }
    setBusy(true);
    try {
      const tenant = await createTenant(name.trim(), pin.trim(), shopId.trim() || undefined);
      setSuccess(`สร้างร้าน "${tenant.name}" สำเร็จ (Shop ID: ${tenant.id})`);
      setName("");
      setShopId("");
      setPin("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "สร้างร้านค้าไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <h2 className="font-semibold text-gray-900">สร้างบัญชีร้านค้าใหม่</h2>
      <label className="block text-xs text-gray-500">
        ชื่อร้าน
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>
      <label className="block text-xs text-gray-500">
        Shop ID (เว้นว่างไว้เพื่อสุ่มให้อัตโนมัติ)
        <input
          value={shopId}
          onChange={(e) => setShopId(e.target.value)}
          placeholder="เช่น my-shop"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>
      <label className="block text-xs text-gray-500">
        PIN (4 หลักขึ้นไป)
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          type="password"
          inputMode="numeric"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full bg-gray-900 text-white rounded-lg py-2.5 font-medium disabled:opacity-50"
      >
        สร้างร้านค้า
      </button>
    </form>
  );
}

function ChangePinForm() {
  const tenantId = getTenantId();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (pin.trim().length < 4) {
      setError("PIN ต้องมีอย่างน้อย 4 หลัก");
      return;
    }
    if (pin !== confirmPin) {
      setError("PIN ทั้งสองช่องไม่ตรงกัน");
      return;
    }
    if (!tenantId) {
      setError("ไม่พบ Shop ID ปัจจุบัน กรุณาเข้าสู่ระบบใหม่");
      return;
    }
    setBusy(true);
    try {
      await changePin(tenantId, pin.trim());
      setSuccess("เปลี่ยน PIN สำเร็จ");
      setPin("");
      setConfirmPin("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "เปลี่ยน PIN ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <h2 className="font-semibold text-gray-900">เปลี่ยน PIN Code</h2>
      <label className="block text-xs text-gray-500">
        PIN ใหม่ (4 หลักขึ้นไป)
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          type="password"
          inputMode="numeric"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>
      <label className="block text-xs text-gray-500">
        ยืนยัน PIN ใหม่
        <input
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value)}
          type="password"
          inputMode="numeric"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full bg-gray-900 text-white rounded-lg py-2.5 font-medium disabled:opacity-50"
      >
        เปลี่ยน PIN
      </button>
    </form>
  );
}
