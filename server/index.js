// 부트스트랩 — express 앱 생성, 라우터 mount, 토큰 인덱스 사전 빌드.
import express from "express";
import { config } from "./config.js";
import { getTokenIndex } from "./services/tokens.service.js";
import tokensRouter from "./routes/tokens.routes.js";
import deviceRouter from "./routes/device.routes.js";
import notesRouter from "./routes/notes.routes.js";
import capturesRouter from "./routes/captures.routes.js";

const app = express();
app.use(express.json());

// 이 서버는 Figma 플러그인 iframe(origin: null)이 호출한다 — cross-origin이라
// CORS 허용이 필요. 127.0.0.1 바인딩이라 로컬 프로세스만 닿지만, 브라우저를
// 통한 접근까지 막으려면 토큰을 추가하는 게 정석.
// ponytail: 로컬 전용 dev 도구라 permissive CORS. 노출 우려 시 공유 토큰 헤더로 상향.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// 라우터 mount — figma 라우트는 플러그인 버전에선 뺀다(선택 노드를 네이티브
// Figma API로 직접 받으므로 REST/토큰 불필요).
app.use("/api/tokens", tokensRouter);
app.use("/api/device", deviceRouter);
app.use("/api/notes", notesRouter);
app.use("/api/captures", capturesRouter);

// 헬스체크
app.get("/api/health", (req, res) => res.json({ ok: true }));

// 공통 에러 핸들러
app.use((err, req, res, next) => {
  console.error("[error]", err.message);
  res.status(err.status || 500).json({ error: err.message || "server error" });
});

// 서버 시작 시 토큰 인덱스 사전 빌드 → 콘솔 요약
const { meta, warnings } = getTokenIndex();
console.log(`[tokens] 인덱스 빌드: 총 ${meta.total}개`, meta.byCategory);
if (warnings.length) console.warn("[tokens] 경고:", warnings);

// 127.0.0.1 로만 바인딩 — 이 서버는 인증이 없고 adb/Figma 토큰을 다루므로
// 외부에서 접근 가능한 주소에 열리면 안 된다. (호스트를 빼면 0.0.0.0 = 전체 노출)
app.listen(config.port, "127.0.0.1", () => {
  console.log(`[server] http://localhost:${config.port}`);
});
