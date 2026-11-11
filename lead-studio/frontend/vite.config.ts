import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.GITHUB_ACTIONS ? "/wavely-crossborder/lead-studio/" : "/",
  server: { host: "127.0.0.1", port: 5178, proxy: { "/api": "http://127.0.0.1:8765", "/qr": "http://127.0.0.1:8765" } },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
})
