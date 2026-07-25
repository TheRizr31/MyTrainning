import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { installStorage } from "./storage.js";
import { installCloudflareStorage } from "./cloudflareStorage.js";
import "./index.css";

// Si VITE_API_URL est configurée, on utilise l'API Cloudflare (D1).
// Sinon, repli sur l'adaptateur localStorage. Dans les deux cas, l'appel
// doit se faire AVANT le premier rendu, sinon le chargement initial échoue.
installCloudflareStorage();
installStorage();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
