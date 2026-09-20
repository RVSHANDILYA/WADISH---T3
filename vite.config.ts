import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname.replace(/^\/(\w:)/, "$1") } },
  server: { port: 5173, host: "0.0.0.0", proxy: { "/api": "http://127.0.0.1:3001" } },
});
