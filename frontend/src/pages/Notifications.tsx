import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { NotificationEvent } from "../types";

export default function Notifications() {
  const [events, setEvents] = useState<NotificationEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<NotificationEvent[]>("/notifications")
      .then(setEvents)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!events) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
      <p className="text-xs text-gray-500">
        Mock channel — a real LINE/Facebook/Telegram adapter can implement the same interface later.
      </p>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {events.length === 0 && <p className="p-4 text-sm text-gray-500">No notifications yet.</p>}
        {events.map((e) => (
          <div key={e.id} className="p-4 text-sm">
            <div className="font-medium text-gray-900">{e.message}</div>
            <div className="text-xs text-gray-500">{new Date(e.createdAt).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
