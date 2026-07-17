// 메모 라우트 — HTTP 껍데기만. 로직은 notes.service.js.
// express 5 는 JSON 바디가 없으면 req.body 를 undefined 로 둔다(4 는 {} 였음) → `?? {}` 필수.
import { Router } from "express";
import { listNotes, addNote, updateNote, deleteNote, deleteAllNotes } from "../services/notes.service.js";

const router = Router();

// GET /api/notes?captureId=... — 해당 캡처 세션의 메모 목록
router.get("/", (req, res) => {
  res.json(listNotes(req.query.captureId));
});

// POST /api/notes { captureId, x, y, w, h, text, category } — 메모 추가(w,h 있으면 영역 메모)
router.post("/", (req, res) => {
  const { captureId, x, y, w, h, text, category, measure } = req.body ?? {};
  if (!captureId || !text) return res.status(400).json({ error: "captureId, text 필요" });
  res.json(addNote(captureId, { x, y, w, h, text, category, measure }));
});

// PUT /api/notes/:id { captureId, text, category } — 메모 수정
router.put("/:id", (req, res) => {
  const { captureId, text, category } = req.body ?? {};
  const note = updateNote(captureId, req.params.id, { text, category });
  if (!note) return res.status(404).json({ error: "메모를 찾을 수 없습니다" });
  res.json(note);
});

// DELETE /api/notes/:id?captureId=... — 메모 하나 삭제
router.delete("/:id", (req, res) => {
  const ok = deleteNote(req.query.captureId, req.params.id);
  if (!ok) return res.status(404).json({ error: "메모를 찾을 수 없습니다" });
  res.json({ ok: true });
});

// DELETE /api/notes?captureId=... — 세션 취소 시 그 세션의 메모 전체 삭제
router.delete("/", (req, res) => {
  deleteAllNotes(req.query.captureId);
  res.json({ ok: true });
});

export default router;
