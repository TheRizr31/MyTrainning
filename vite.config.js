import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // base: "./" facilite l'hébergement sur GitHub Pages / sous-dossier.
  base: "./",
  server: {
    host: true, // accessible depuis le téléphone sur le même réseau Wi-Fi
    port: 5173,
  },
});
