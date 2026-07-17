import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { CompareProvider } from "./state/CompareContext.jsx";
import "./styles/global.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CompareProvider>
      <App />
    </CompareProvider>
  </React.StrictMode>
);
