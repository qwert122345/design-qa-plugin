// figma 라우트 — HTTP 껍데기만. 로직은 figma.service.js.
// express 5 는 거부된 프라미스를 자동으로 에러 핸들러에 넘긴다 → try/catch 불필요.
import { Router } from "express";
import { listFrames, listChildren, getNodeImage, getSpec } from "../services/figma.service.js";

const router = Router();

// GET /api/figma/frames?fileKey=...&search=...
router.get("/frames", async (req, res) => {
  res.json(await listFrames(req.query.fileKey, req.query.search));
});

// GET /api/figma/children?fileKey=...&nodeId=...
router.get("/children", async (req, res) => {
  res.json(await listChildren(req.query.fileKey, req.query.nodeId));
});

// GET /api/figma/image?fileKey=...&nodeId=...&scale=2 → image/png
router.get("/image", async (req, res) => {
  const png = await getNodeImage(req.query.fileKey, req.query.nodeId, Number(req.query.scale) || 2);
  res.set("Content-Type", "image/png");
  res.set("Cache-Control", "no-store");
  res.send(png);
});

// GET /api/figma/spec?fileKey=...&nodeId=...
router.get("/spec", async (req, res) => {
  res.json(await getSpec(req.query.fileKey, req.query.nodeId));
});

export default router;
