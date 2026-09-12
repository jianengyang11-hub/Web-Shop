import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Order } from "../types";

const SETTLED = new Set(["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"]);

export default function Sales() {
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

  const settled = orders.filter((o) => SETTLED.has(o.status));
  const totalSales = settled.reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Sales</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500">Total Sales (confirmed+)</div>
          <div className="text-2xl font-semibold text-gray-900 mt-1">฿{totalSales.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500">Confirmed Orders</div>
          <div className="text-2xl font-semibold text-gray-900 mt-1">{settled.length}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {settled.length === 0 && <p className="p-4 text-sm text-gray-500">No confirmed sales yet.</p>}
        {settled.map((o) => (
          <div key={o.id} className="flex items-center justify-between p-3 text-sm">
            <div>
              <div className="font-medium text-gray-900">{o.orderNumber}</div>
              <div className="text-xs text-gray-500">
                {o.confirmedAt ? new Date(o.confirmedAt).toLocaleString() : ""}
              </div>
            </div>
            <div className="font-semibold text-gray-900">฿{o.total.toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
