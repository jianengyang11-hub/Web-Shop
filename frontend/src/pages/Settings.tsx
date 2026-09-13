import { useEffect, useState } from "react";
import { ApiError, addStaff, api, changePin, createTenant, listStaff, removeStaff, resetStaffPin } from "../api/client";
import { getStaffRole } from "../auth";
import { getTenantId } from "../tenant";
import type { Staff } from "../types";

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
      {getStaffRole() === "OWNER" && <StaffManagement />}
    </div>
  );
}

function StaffManagement() {
  const [staffList, setStaffList] = useState<Staff[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [resetPin, setResetPin] = useState("");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  function load() {
    listStaff()
      .then(setStaffList)
      .catch((e) => setError(e instanceof ApiError ? e.message : "โหลดรายชื่อพนักงานไม่สำเร็จ"));
  }

  useEffect(load, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || pin.trim().length < 4) {
      setError("กรุณากรอกชื่อพนักงานและ PIN อย่างน้อย 4 หลัก");
      return;
    }
    setBusy(true);
    try {
      await addStaff(name.trim(), pin.trim());
      setName("");
      setPin("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "เพิ่มพนักงานไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPin(staffId: string) {
    setError(null);
    if (resetPin.trim().length < 4) {
      setError("PIN ต้องมีอย่างน้อย 4 หลัก");
      return;
    }
    setBusy(true);
    try {
      await resetStaffPin(staffId, resetPin.trim());
      setResetTargetId(null);
      setResetPin("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "รีเซ็ต PIN ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(staffId: string) {
    setError(null);
    setBusy(true);
    try {
      await removeStaff(staffId);
      setConfirmRemoveId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ลบพนักงานไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <h2 className="font-semibold text-gray-900">จัดการพนักงาน</h2>

      {staffList === null && <p className="text-sm text-gray-500">Loading...</p>}
      {staffList && (
        <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
          {staffList.map((member) => (
            <div key={member.id} className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-medium text-gray-900">{member.name}</span>{" "}
                  <span className="text-xs text-gray-500">({member.role === "OWNER" ? "เจ้าของร้าน" : "พนักงาน"})</span>
                </div>
                <div className="flex gap-2 text-xs">
                  <button
                    onClick={() => {
                      setResetTargetId(resetTargetId === member.id ? null : member.id);
                      setResetPin("");
                    }}
                    className="text-blue-600 font-medium"
                  >
                    รีเซ็ต PIN
                  </button>
                  <button
                    onClick={() => setConfirmRemoveId(confirmRemoveId === member.id ? null : member.id)}
                    className="text-red-600 font-medium"
                  >
                    ลบ
                  </button>
                </div>
              </div>

              {resetTargetId === member.id && (
                <div className="flex gap-2">
                  <input
                    value={resetPin}
                    onChange={(e) => setResetPin(e.target.value)}
                    type="password"
                    inputMode="numeric"
                    placeholder="PIN ใหม่ (4 หลักขึ้นไป)"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
                  />
                  <button
                    disabled={busy}
                    onClick={() => handleResetPin(member.id)}
                    className="bg-gray-900 text-white rounded-lg px-3 text-sm font-medium disabled:opacity-50"
                  >
                    บันทึก
                  </button>
                </div>
              )}

              {confirmRemoveId === member.id && (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span>ลบ "{member.name}" ออกจากร้านนี้ใช่หรือไม่?</span>
                  <button
                    disabled={busy}
                    onClick={() => handleRemove(member.id)}
                    className="text-red-600 font-semibold disabled:opacity-50"
                  >
                    ยืนยันลบ
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={handleAdd} className="border-t border-gray-100 pt-3 space-y-2">
        <p className="text-xs text-gray-500 font-medium">เพิ่มพนักงานใหม่</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ชื่อพนักงาน"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          type="password"
          inputMode="numeric"
          placeholder="PIN ของพนักงาน (4 หลักขึ้นไป)"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-gray-900 text-white rounded-lg py-2.5 font-medium disabled:opacity-50"
        >
          เพิ่มพนักงาน
        </button>
      </form>
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
