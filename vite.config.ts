import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // On GitHub Pages the app is served from /piano-/, so use an absolute base
  // there; locally (dev/preview) keep a relative base so it works from root.
  base: process.env.GITHUB_PAGES ? "/piano-/" : "./",
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    target: "es2021",
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          osmd: ["opensheetmusicdisplay"],
          anthropic: ["@anthropic-ai/sdk"],
          tone: ["tone"],
        },
      },
    },
  },
});
