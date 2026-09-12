import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Shop Owner Dashboard",
        short_name: "ShopOwner",
        description: "Confirm orders, manage stock and products from any phone or desktop.",
        theme_color: "#111827",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        // wrangler dev's default local port for the Workers backend
        target: process.env.VITE_API_PROXY_TARGET || "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
