import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Mise — Interactive Cookbook",
        short_name: "Mise",
        description:
          "An interactive cookbook you can run — execute recipes as a live flow chart.",
        theme_color: "#0c0a09",
        background_color: "#0c0a09",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // the data-laden JS bundle
      },
    }),
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: { port: 5173, open: false },
});
