import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/file-server/",
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", {}]],
      },
    }),
  ],
  server: {
    proxy: {
      "/file-server/api/file": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
    },
  },
});
