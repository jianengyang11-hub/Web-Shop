import { NavLink, Outlet } from "react-router-dom";
import { clearToken, getStaffName, getStaffRole } from "../auth";
import { clearTenantId } from "../tenant";

const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: "🏠", end: true },
  { to: "/orders", label: "Orders", icon: "🧾" },
  { to: "/products", label: "Products", icon: "📦" },
  { to: "/stock", label: "Stock", icon: "📊" },
  { to: "/customers", label: "Customers", icon: "👤" },
  { to: "/sales", label: "Sales", icon: "💰" },
  { to: "/notifications", label: "Notifications", icon: "🔔" },
  { to: "/ai-conversations", label: "AI Conversations", icon: "🤖" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

// Highest-priority actions for the small screen: an owner running the shop from one phone
// needs these without digging into a "more" menu.
const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((item) =>
  ["/", "/orders", "/stock", "/notifications"].includes(item.to)
);

function navLinkClass(isActive: boolean, base: string) {
  return `${base} ${isActive ? "text-gray-900 font-semibold" : "text-gray-500"}`;
}

function handleLogout() {
  clearToken();
  clearTenantId();
  window.location.reload();
}

export default function Layout() {
  const staffName = getStaffName();
  const staffRole = getStaffRole();

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-gray-200 md:bg-white md:sticky md:top-0 md:h-screen">
        <div className="px-4 py-5">
          <div className="text-lg font-bold text-gray-900">Shop Owner</div>
          {staffName && (
            <div className="text-xs text-gray-500">
              {staffName} · {staffRole === "OWNER" ? "เจ้าของร้าน" : "พนักงาน"}
            </div>
          )}
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                navLinkClass(
                  isActive,
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-gray-100"
                )
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-2 pb-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            <span>🚪</span>
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
          <span className="text-base font-bold text-gray-900">Shop Owner</span>
        </header>

        <main className="flex-1 px-4 py-4 md:px-8 md:py-6 pb-20 md:pb-6 max-w-5xl w-full mx-auto">
          <Outlet />
        </main>

        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex justify-around py-2 z-10">
          {MOBILE_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                navLinkClass(isActive, "flex flex-col items-center gap-0.5 text-xs px-2")
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to="/more"
            className={({ isActive }) => navLinkClass(isActive, "flex flex-col items-center gap-0.5 text-xs px-2")}
          >
            <span className="text-lg">☰</span>
            More
          </NavLink>
        </nav>
      </div>
    </div>
  );
}
