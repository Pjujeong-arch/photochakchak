import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "html-no-crossorigin",
      transformIndexHtml(html) {
        return html.replace(/\s+crossorigin(="[^"]*")?/g, "");
      },
    },
  ],
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:4173",
    },
  },
});
