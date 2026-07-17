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
//  2) 빌드 끝에 index.html 의 type="module" 를 떼어 classic <script> 로 바꾼 뒤,
//  3) 그 스크립트를 </body> 직전으로 옮긴다. (module 은 defer 라 DOM 이후 실행되지만
//     classic 은 즉시 실행 → head 에 있으면 #root 가 아직 없어 React 가 못 붙는다.)
const API_BASE = process.env.VITE_API_BASE || "";
const OUT_DIR = path.resolve(__dirname, "figma-plugin/dist");

function figmaClassicScript() {
  return {
    name: "figma-classic-script",
    closeBundle() {
      const file = path.join(OUT_DIR, "index.html");
      if (!fs.existsSync(file)) return;
      let html = fs.readFileSync(file, "utf8").replace(/<script type="module"(\s+crossorigin)?>/g, "<script>");
      // 인라인 <script>…</script>(src 없는 것)를 모두 body 끝으로 이동 — DOM 이후 실행 보장
      const scripts = [];
      html = html.replace(/<script>[\s\S]*?<\/script>/g, (m) => {
        scripts.push(m);
        return "";
      });
      html = html.replace("</body>", scripts.join("\n") + "\n</body>");
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
