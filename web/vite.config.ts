import { defineConfig } from "vite";
import { join } from "path";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/file-server",
  build: {
    outDir: join(__dirname, "..", "dist"),
  },
  server: {
    proxy: {
      "/file-server/api": {
        target: "http://localhost:8080",
      },
    },
  },
});
