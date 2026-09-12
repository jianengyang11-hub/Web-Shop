import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Product, ProductVariant } from "../types";

function VariantRow({ variant, onChanged }: { variant: ProductVariant; onChanged: () => void }) {
  const [stock, setStock] = useState(String(variant.stockQuantity));

  async function saveStock() {
    const value = Number(stock);
    if (Number.isNaN(value)) return;
    await api.put(`/variants/${variant.id}/stock`, { stockQuantity: value });
    onChanged();
  }

  async function remove() {
    await api.delete(`/variants/${variant.id}`);
    onChanged();
  }

  const isLow = variant.stockQuantity <= variant.lowStockThreshold;

  return (
    <div className="flex items-center justify-between py-2 text-sm gap-2">
      <div className="min-w-0">
        <div className="font-medium text-gray-900 truncate">{variant.sku}</div>
        <div className="text-xs text-gray-500">
          {[variant.color, variant.size].filter(Boolean).join(" / ") || "—"}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className={`w-16 rounded border px-2 py-1 text-right ${isLow ? "border-amber-400 bg-amber-50" : "border-gray-300"}`}
        />
        <button onClick={saveStock} className="text-blue-600 text-xs font-medium">
          Save
        </button>
        <button onClick={remove} className="text-red-600 text-xs font-medium">
          Delete
        </button>
      </div>
    </div>
  );
}

function ProductCard({ product, onChanged }: { product: Product; onChanged: () => void }) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [newVariant, setNewVariant] = useState({ sku: "", color: "", size: "", stockQuantity: "0" });

  const loadVariants = () => api.get<ProductVariant[]>(`/products/${product.id}/variants`).then(setVariants);

  useEffect(() => {
    if (expanded) loadVariants();
  }, [expanded]);

  async function addVariant(e: React.FormEvent) {
    e.preventDefault();
    if (!newVariant.sku) return;
    await api.post(`/products/${product.id}/variants`, {
      sku: newVariant.sku,
      color: newVariant.color || null,
      size: newVariant.size || null,
      stockQuantity: Number(newVariant.stockQuantity) || 0,
    });
    setNewVariant({ sku: "", color: "", size: "", stockQuantity: "0" });
    loadVariants();
  }

  async function removeProduct() {
    await api.delete(`/products/${product.id}`);
    onChanged();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-gray-900">{product.name}</div>
          <div className="text-xs text-gray-500">฿{product.price.toFixed(2)}</div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setExpanded((v) => !v)} className="text-sm text-blue-600">
            {expanded ? "Hide variants" : "Manage variants"}
          </button>
          <button onClick={removeProduct} className="text-sm text-red-600">
            Delete
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <div className="divide-y divide-gray-100">
            {variants.map((v) => (
              <VariantRow key={v.id} variant={v} onChanged={loadVariants} />
            ))}
            {variants.length === 0 && <p className="text-sm text-gray-500 py-2">No variants yet.</p>}
          </div>

          <form onSubmit={addVariant} className="flex flex-wrap gap-2 mt-3">
            <input
              placeholder="SKU"
              value={newVariant.sku}
              onChange={(e) => setNewVariant({ ...newVariant, sku: e.target.value })}
              className="rounded border border-gray-300 px-2 py-1 text-sm w-28"
            />
            <input
              placeholder="Color"
              value={newVariant.color}
              onChange={(e) => setNewVariant({ ...newVariant, color: e.target.value })}
              className="rounded border border-gray-300 px-2 py-1 text-sm w-24"
            />
            <input
              placeholder="Size"
              value={newVariant.size}
              onChange={(e) => setNewVariant({ ...newVariant, size: e.target.value })}
              className="rounded border border-gray-300 px-2 py-1 text-sm w-20"
            />
            <input
              placeholder="Stock"
              value={newVariant.stockQuantity}
              onChange={(e) => setNewVariant({ ...newVariant, stockQuantity: e.target.value })}
              className="rounded border border-gray-300 px-2 py-1 text-sm w-20"
            />
            <button type="submit" className="bg-gray-900 text-white rounded px-3 py-1 text-sm">
              Add Variant
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", price: "" });

  const load = () => {
    setError(null);
    api
      .get<Product[]>("/products")
      .then(setProducts)
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.price) return;
    await api.post("/products", { name: form.name, price: Number(form.price) });
    setForm({ name: "", price: "" });
    load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Products</h1>

      <form onSubmit={addProduct} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-2">
        <input
          placeholder="Product name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded border border-gray-300 px-3 py-2 text-sm flex-1 min-w-[160px]"
        />
        <input
          placeholder="Price"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          className="rounded border border-gray-300 px-3 py-2 text-sm w-28"
        />
        <button type="submit" className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium">
          Add Product
        </button>
      </form>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

      <div className="space-y-3">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} onChanged={load} />
        ))}
        {!error && products.length === 0 && <p className="text-sm text-gray-500">No products yet.</p>}
      </div>
    </div>
  );
}
