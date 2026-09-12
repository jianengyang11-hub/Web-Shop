import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ProductVariant } from "../types";

function Section({ title, variants }: { title: string; variants: ProductVariant[] }) {
  return (
    <div>
      <h2 className="font-semibold text-gray-900 mb-2">
        {title} <span className="text-gray-400 font-normal">({variants.length})</span>
      </h2>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {variants.length === 0 && <p className="p-4 text-sm text-gray-500">None.</p>}
        {variants.map((v) => (
          <div key={v.id} className="flex items-center justify-between p-3 text-sm">
            <div>
              <div className="font-medium text-gray-900">{v.sku}</div>
              <div className="text-xs text-gray-500">
                {[v.color, v.size].filter(Boolean).join(" / ") || "—"}
              </div>
            </div>
            <div className="font-semibold text-gray-900">{v.stockQuantity}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Stock() {
  const [all, setAll] = useState<ProductVariant[] | null>(null);
  const [low, setLow] = useState<ProductVariant[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ProductVariant[]>("/stock")
      .then(setAll)
      .catch((e) => setError(e.message));
    api.get<ProductVariant[]>("/stock/low").then(setLow).catch(() => {});
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!all) return <p className="text-gray-500">Loading...</p>;

  const outOfStock = all.filter((v) => v.stockQuantity === 0);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Stock</h1>
      <Section title="Low Stock" variants={low} />
      <Section title="Out of Stock" variants={outOfStock} />
      <Section title="All Stock" variants={all} />
    </div>
  );
}
