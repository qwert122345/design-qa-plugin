import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import fs from "node:fs";
import path from "node:path";

// 두 가지로 쓰인다:
//  - dev(웹처럼): `vite` — web/ 를 루트로, /api 는 :3011 로 프록시. __API_BASE__="".
//  - 플러그인 UI 빌드: `vite build` — JS/CSS 를 전부 인라인한 단일 HTML
//    (figma-plugin/dist/index.html). __API_BASE__ 로 :3011 절대주소 주입.
//
// Figma 플러그인 iframe(null origin + CSP)은 인라인 `type="module"` 스크립트를
// 실행하지 않는다 → 그대로 두면 UI 가 검은 화면. 그래서:
//  1) 번들을 iife 로 뽑아 classic 스크립트로도 안전하게 만들고,
//  2) 빌드 끝에 index.html 의 여는 태그 `type="module"` 만 떼어 classic <script> 로.
// classic 은 즉시 실행이라 head 에 있으면 #root 전에 돌지만, main.jsx 가
// DOMContentLoaded 를 기다렸다 마운트하므로 스크립트를 옮길 필요는 없다.
// (스크립트를 정규식으로 옮기면 번들 안의 "<script></script>" 같은 문자열에서 깨진다.)
const API_BASE = process.env.VITE_API_BASE || "";
const OUT_DIR = path.resolve(__dirname, "figma-plugin/dist");

function figmaClassicScript() {
  return {
    name: "figma-classic-script",
    closeBundle() {
      const file = path.join(OUT_DIR, "index.html");
      if (!fs.existsSync(file)) return;
      // 여는 태그의 속성만 교체 — 스크립트 내용은 건드리지 않는다(안전).
      const html = fs.readFileSync(file, "utf8").replace(/<script type="module"(\s+crossorigin)?>/g, "<script>");
      fs.writeFileSync(file, html);
    },
  };
}

export default defineConfig({
  root: "web",
  plugins: [react(), viteSingleFile(), figmaClassicScript()],
  define: {
    __API_BASE__: JSON.stringify(API_BASE),
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3011",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: OUT_DIR,
    emptyOutDir: false, // code.js 는 esbuild 가 따로 넣으므로 지우지 않는다
    modulePreload: false, // module preload 폴리필 스크립트 제거
    cssCodeSplit: false,
    rollupOptions: {
      output: { format: "iife", inlineDynamicImports: true },
    },
  },
});
