import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import TenantGate from "./components/TenantGate";
import AIConversations from "./pages/AIConversations";
import Customers from "./pages/Customers";
import More from "./pages/More";
import Notifications from "./pages/Notifications";
import OrderDetail from "./pages/OrderDetail";
import Orders from "./pages/Orders";
import Overview from "./pages/Overview";
import Products from "./pages/Products";
import Sales from "./pages/Sales";
import Settings from "./pages/Settings";
import Stock from "./pages/Stock";

export default function App() {
  return (
    <TenantGate>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="products" element={<Products />} />
          <Route path="stock" element={<Stock />} />
          <Route path="customers" element={<Customers />} />
          <Route path="sales" element={<Sales />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="ai-conversations" element={<AIConversations />} />
          <Route path="settings" element={<Settings />} />
          <Route path="more" element={<More />} />
        </Route>
      </Routes>
    </TenantGate>
  );
}
