import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// 두 가지로 쓰인다:
//  - dev(웹처럼): `vite` — web/ 를 루트로, /api 는 :3001 로 프록시.
//  - 플러그인 UI 빌드: `vite build` — JS/CSS 를 전부 인라인한 단일 HTML
//    (figma-plugin/dist/index.html). Figma 플러그인 ui 는 로컬 단일 파일이어야
//    하고, 이때 API 는 절대주소(VITE_API_BASE)로 :3001 을 직접 호출한다.
export default defineConfig({
  root: "web",
  plugins: [react(), viteSingleFile()],
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
    outDir: "../figma-plugin/dist",
    emptyOutDir: false, // code.js 는 esbuild 가 따로 넣으므로 지우지 않는다
  },
});
