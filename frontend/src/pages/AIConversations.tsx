import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import type { Order } from "../types";

interface ChannelMessage {
  id: string;
  customerName: string | null;
  customerPhone: string | null;
  channel: "WHATSAPP" | "MESSENGER";
  direction: "INBOUND" | "OUTBOUND";
  body: string;
  createdAt: string;
}

export default function AIConversations() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [messages, setMessages] = useState<ChannelMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Order[]>("/orders")
      .then((all) => setOrders(all.filter((o) => o.channel === "AI")))
      .catch((e) => setError(e.message));
    api
      .get<ChannelMessage[]>("/whatsapp-messages")
      .then(setMessages)
      .catch(() => setMessages([]));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!orders) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-900">AI Conversations</h1>
        <p className="text-xs text-gray-500">
          Orders the AI created on a customer's behalf. The AI can only submit orders for review — it
          can never confirm, reject, or touch stock; only the Owner can.
        </p>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {orders.length === 0 && <p className="p-4 text-sm text-gray-500">No AI-created orders yet.</p>}
          {orders.map((o) => (
            <Link key={o.id} to={`/orders/${o.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50">
              <div>
                <div className="text-sm font-medium text-gray-900">{o.orderNumber}</div>
                <div className="text-xs text-gray-500">฿{o.total.toFixed(2)}</div>
              </div>
              <StatusBadge status={o.status} />
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold text-gray-900">Channel Messages</h2>
        <p className="text-xs text-gray-500">
          Raw inbound messages logged by the WhatsApp/Messenger webhooks — no NLP is applied; this
          is a log, not a chat interface.
        </p>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {(!messages || messages.length === 0) && <p className="p-4 text-sm text-gray-500">No messages yet.</p>}
          {messages?.map((m) => (
            <div key={m.id} className="p-4 text-sm">
              <div className="flex items-center justify-between">
                <div className="font-medium text-gray-900">{m.customerName ?? m.customerPhone ?? "Unknown"}</div>
                <span className="text-xs text-gray-400">{m.channel}</span>
              </div>
              <div className="text-gray-600">{m.body}</div>
              <div className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
