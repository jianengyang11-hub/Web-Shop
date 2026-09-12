import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import type { Order } from "../types";

export default function Orders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Order[]>("/orders")
      .then(setOrders)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!orders) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Orders</h1>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {orders.length === 0 && <p className="p-4 text-sm text-gray-500">No orders yet.</p>}
        {orders.map((o) => (
          <Link key={o.id} to={`/orders/${o.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50">
            <div>
              <div className="text-sm font-medium text-gray-900">{o.orderNumber}</div>
              <div className="text-xs text-gray-500">
                {o.items.length} item(s) · ฿{o.total.toFixed(2)} · {new Date(o.createdAt).toLocaleString()}
              </div>
            </div>
            <StatusBadge status={o.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}
