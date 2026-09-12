import type { OrderStatus } from "../types";

const COLORS: Record<OrderStatus, string> = {
  NEW: "bg-gray-100 text-gray-700",
  PENDING_CONFIRMATION: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  PREPARING: "bg-indigo-100 text-indigo-800",
  SHIPPED: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-200 text-gray-600",
  REJECTED: "bg-red-100 text-red-800",
};

export default function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${COLORS[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}
