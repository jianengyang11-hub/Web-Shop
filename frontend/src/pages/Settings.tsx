import { useEffect, useState } from "react";
import { ApiError, api } from "../api/client";

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
    </div>
  );
}
