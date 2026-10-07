import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/health": "http://127.0.0.1:8000",
      "/public-config": "http://127.0.0.1:8000",
      "/sessions": "http://127.0.0.1:8000",
      "/requirements": "http://127.0.0.1:8000",
    },
  },
});
