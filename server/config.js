// 서버 전역 설정 — env + 상수 + 토큰 파일 목록을 여기 한 곳에 모은다.
// .env 는 node 의 --env-file-if-exists 로 로드된다(package.json 스크립트 참고).
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");

export const config = {
  // 플러그인 helper 서버 기본 포트. design-qa 웹(3001)과 동시에 띄워도
  // 충돌하지 않도록 다른 포트를 쓴다.
  port: Number(process.env.PORT) || 3011,
  figmaToken: process.env.FIGMA_TOKEN || "",
  defaultFileKey: process.env.DEFAULT_FILE_KEY || "",

  // adb 명령 타임아웃(ms)
  adbTimeoutMs: 15000,

  // figma REST 기준 URL
  figmaBaseUrl: "https://api.figma.com",
};

// ── 디자인 토큰 파일 목록 (명시적 — 폴더 자동 스캔 X) ──────────────
// 파일을 추가/교체하려면 이 목록만 고치면 된다.
export const TOKEN_FILES = {
  color: [
    { path: "tokens/Semantic_Color_Normal.json", kind: "semantic", mode: "Normal" },
    { path: "tokens/Semantic_Color_Inverse.json", kind: "semantic", mode: "Inverse" },
    { path: "tokens/Component_Color_Normal.json", kind: "component", mode: "Normal" },
    { path: "tokens/Component_Color_Inverse.json", kind: "component", mode: "Inverse" },
  ],
  scale: [
    { path: "tokens/Semantic_Scale.json" },
  ],
  typography: {
    styles: "tokens/typographyStyles.json", // 조립표(스타일→값)
    primitives: "tokens/Primitive_Text.json", // 참조값(표시용)
  },
};

// 토큰 파일 절대경로 헬퍼
export const tokenPath = (rel) => path.resolve(ROOT, rel);

// ── 로컬 QA 데이터 ────────────────────────────────────────────────
// 개인 작업물이라 전부 gitignore. 저장 시 디렉터리가 없으면 각 서비스가 만든다.
const DATA_DIR = path.resolve(ROOT, "qa-data");

// QA 메모(어노테이션) 저장 파일 — 캡처 세션(captureId)별로 묶어 저장.
export const NOTES_FILE = path.resolve(DATA_DIR, "notes.json");

// QA 캡처 저장소 — 이름 붙여 저장한 기기 캡처(스크린샷 + 메타데이터).
export const CAPTURES_DIR = path.resolve(DATA_DIR, "captures");
export const CAPTURES_INDEX_FILE = path.resolve(CAPTURES_DIR, "index.json");
