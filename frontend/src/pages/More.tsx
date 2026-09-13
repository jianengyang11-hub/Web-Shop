import { Link } from "react-router-dom";
import { getStaffRole } from "../auth";

const ITEMS = [
  { to: "/products", label: "Products", icon: "📦" },
  { to: "/customers", label: "Customers", icon: "👤" },
  { to: "/sales", label: "Sales", icon: "💰" },
  { to: "/ai-conversations", label: "AI Conversations", icon: "🤖" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

export default function More() {
  const items = ITEMS.filter((item) => item.to !== "/settings" || getStaffRole() === "OWNER");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">More</h1>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {items.map((item) => (
          <Link key={item.to} to={item.to} className="flex items-center gap-3 p-4 text-sm hover:bg-gray-50">
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
