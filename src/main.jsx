import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { installStorage } from "./storage.js";
import "./index.css";

// Hors Claude, window.storage n'existe pas : on installe l'adaptateur
// localStorage AVANT le premier rendu, sinon le chargement initial échoue.
installStorage();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
