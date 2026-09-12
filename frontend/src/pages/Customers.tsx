import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Customer } from "../types";

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Customer[]>("/customers")
      .then(setCustomers)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!customers) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Customers</h1>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {customers.length === 0 && <p className="p-4 text-sm text-gray-500">No customers yet.</p>}
        {customers.map((c) => (
          <div key={c.id} className="p-4 text-sm">
            <div className="font-medium text-gray-900">{c.name}</div>
            <div className="text-xs text-gray-500">
              {[c.phone, c.email, c.channel].filter(Boolean).join(" · ") || "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
