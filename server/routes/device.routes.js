// 디바이스 라우트 — HTTP 껍데기만. 로직은 device.service.js.
// express 5 는 거부된 프라미스를 자동으로 에러 핸들러에 넘긴다 → try/catch 불필요.
import { Router } from "express";
import { getStatus, capturePng, getHierarchy, openMirror } from "../services/device.service.js";

const router = Router();

// GET /api/device/status — 연결/해상도/density
router.get("/status", async (req, res) => {
  res.json(await getStatus());
});

// GET /api/device/capture — 스크린샷 PNG (image/png)
router.get("/capture", async (req, res) => {
  const png = await capturePng();
  res.set("Content-Type", "image/png");
  res.set("Cache-Control", "no-store");
  res.send(png);
});

// GET /api/device/hierarchy — uiautomator 노드 배열 (빈 배열이어도 정상)
router.get("/hierarchy", async (req, res) => {
  res.json(await getHierarchy());
});

// POST /api/device/mirror — scrcpy 미러링 창 띄우기 ({ started: false } = 이미 떠 있음)
// body: { screen: { width, height, top } } — 창을 어디 붙일지. 없으면 scrcpy 기본 배치.
// express 5 는 바디가 없으면 req.body 가 undefined 다 → ?? {}
router.post("/mirror", async (req, res) => {
  const { screen } = req.body ?? {};
  res.json(await openMirror(screen));
});

export default router;
