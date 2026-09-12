import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, api } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import type { Order, OrderStatus } from "../types";

const NEXT_ACTION: Partial<Record<OrderStatus, { action: string; label: string; target: OrderStatus }>> = {
  CONFIRMED: { action: "preparing", label: "Mark Preparing", target: "PREPARING" },
  PREPARING: { action: "shipped", label: "Mark Shipped", target: "SHIPPED" },
  SHIPPED: { action: "delivered", label: "Mark Delivered", target: "DELIVERED" },
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!id) return;
    api
      .get<Order>(`/orders/${id}`)
      .then(setOrder)
      .catch((e) => setError(e.message));
  };

  useEffect(load, [id]);

  async function runAction(action: string) {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.post<Order>(`/orders/${id}/${action}`);
      setOrder(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (error && !order) return <p className="text-red-600">{error}</p>;
  if (!order) return <p className="text-gray-500">Loading...</p>;

  const nextAction = NEXT_ACTION[order.status];

  return (
    <div className="space-y-4">
      <button onClick={() => navigate(-1)} className="text-sm text-blue-600">
        ← Back
      </button>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">{order.orderNumber}</h1>
          <StatusBadge status={order.status} />
        </div>
        <div className="text-xs text-gray-500">
          Created {new Date(order.createdAt).toLocaleString()} · Channel: {order.channel}
        </div>

        <div className="divide-y divide-gray-100 border-t border-gray-100 pt-2">
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between py-2 text-sm">
              <div>
                <div className="font-medium text-gray-900">{item.productNameSnapshot}</div>
                <div className="text-xs text-gray-500">
                  {[item.variantSnapshot.color, item.variantSnapshot.size].filter(Boolean).join(" / ") ||
                    item.variantSnapshot.sku}{" "}
                  × {item.quantity}
                </div>
              </div>
              <div className="text-gray-900">฿{item.subtotal.toFixed(2)}</div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-2 text-sm space-y-1">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span>฿{order.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Discount</span>
            <span>-฿{order.discount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Shipping</span>
            <span>฿{order.shippingFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold text-gray-900">
            <span>Total</span>
            <span>฿{order.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

      {order.status === "PENDING_CONFIRMATION" && (
        <div className="flex gap-3">
          <button
            disabled={busy}
            onClick={() => runAction("confirm")}
            className="flex-1 bg-gray-900 text-white rounded-lg py-2.5 font-medium disabled:opacity-50"
          >
            Confirm
          </button>
          <button
            disabled={busy}
            onClick={() => runAction("reject")}
            className="flex-1 bg-white border border-gray-300 text-gray-900 rounded-lg py-2.5 font-medium disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}

      {nextAction && (
        <button
          disabled={busy}
          onClick={() => runAction(nextAction.action)}
          className="w-full bg-gray-900 text-white rounded-lg py-2.5 font-medium disabled:opacity-50"
        >
          {nextAction.label}
        </button>
      )}
    </div>
  );
}
