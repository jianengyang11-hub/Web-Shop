import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import type { DashboardOverview } from "../types";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-semibold text-gray-900 mt-1">{value}</div>
    </div>
  );
}

export default function Overview() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardOverview>("/dashboard/overview")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Overview</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="New Orders" value={data.newOrders} />
        <StatCard label="Pending Confirmation" value={data.pendingConfirmation} />
        <StatCard label="Confirmed Orders" value={data.confirmedOrders} />
        <StatCard label="Today's Sales" value={`฿${data.todaysSales.toFixed(2)}`} />
        <StatCard label="Total Products" value={data.totalProducts} />
        <StatCard label="Low Stock" value={data.lowStockCount} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-900">Recent Orders</h2>
          <Link to="/orders" className="text-sm text-blue-600">
            View all
          </Link>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {data.recentOrders.length === 0 && <p className="p-4 text-sm text-gray-500">No orders yet.</p>}
          {data.recentOrders.map((o) => (
            <Link
              key={o.id}
              to={`/orders/${o.id}`}
              className="flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <div>
                <div className="text-sm font-medium text-gray-900">{o.orderNumber}</div>
                <div className="text-xs text-gray-500">฿{o.total.toFixed(2)}</div>
              </div>
              <StatusBadge status={o.status} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
