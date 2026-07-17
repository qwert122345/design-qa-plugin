// 캡처 저장소 라우트 — HTTP 껍데기만. 로직은 captures.service.js.
import { Router } from "express";
import express from "express";
import {
  listCaptures,
  listTrash,
  saveCapture,
  getCaptureImagePath,
  trashCapture,
  restoreCapture,
  purgeCapture,
} from "../services/captures.service.js";

const router = Router();

// GET /api/captures — 저장된 캡처 메타데이터 목록
router.get("/", (req, res) => {
  res.json(listCaptures());
});

// GET /api/captures/trash — 휴지통 목록
router.get("/trash", (req, res) => {
  res.json(listTrash());
});

// POST /api/captures?id=...&name=...&nodeId=...&nodeName=...&serial=..&model=..&w=..&h=..&density=..
// (body: image/png raw). 바디가 PNG 라서 메타데이터는 쿼리로 받는다.
router.post("/", express.raw({ type: "image/png", limit: "20mb" }), (req, res) => {
  const { id, name, nodeId, nodeName, serial, model, w, h, density } = req.query;
  if (!id || !Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: "id, image/png 바디가 필요합니다" });
  }
  const device = serial
    ? { serial, model: model || null, width: Number(w) || null, height: Number(h) || null, density: Number(density) || null }
    : null;
  res.json(saveCapture({ id, name, nodeId, nodeName, device, pngBuffer: req.body }));
});

// GET /api/captures/:id/image — 저장된 캡처 PNG
router.get("/:id/image", (req, res) => {
  const p = getCaptureImagePath(req.params.id);
  if (!p) return res.status(404).json({ error: "캡처를 찾을 수 없습니다" });
  res.set("Content-Type", "image/png");
  res.sendFile(p);
});

// POST /api/captures/:id/restore — 휴지통에서 꺼내기
router.post("/:id/restore", (req, res) => {
  const ok = restoreCapture(req.params.id);
  if (!ok) return res.status(404).json({ error: "휴지통에 없는 캡처입니다" });
  res.json({ ok: true });
});

// DELETE /api/captures/:id — 휴지통으로. ?purge=1 이면 파일까지 완전 삭제.
router.delete("/:id", (req, res) => {
  const purge = req.query.purge === "1";
  const ok = purge ? purgeCapture(req.params.id) : trashCapture(req.params.id);
  if (!ok) return res.status(404).json({ error: "캡처를 찾을 수 없습니다" });
  res.json({ ok: true });
});

export default router;
