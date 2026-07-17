import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { CompareProvider } from "./state/CompareContext.jsx";
import "./styles/global.css";

// 플러그인 빌드에선 번들이 classic 스크립트로 즉시 실행되므로 #root(body)가
// 아직 없을 수 있다 → DOM 준비 후 마운트. (dev/module 빌드는 이미 준비된 상태라 바로 실행.)
function mount() {
  createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <CompareProvider>
        <App />
      </CompareProvider>
    </React.StrictMode>
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
