// 토큰 라우트 — HTTP 껍데기만. 로직은 tokens.service.js.
import { Router } from "express";
import { getTokenIndex } from "../services/tokens.service.js";

const router = Router();

// GET /api/tokens — 통합 토큰 인덱스 반환.
// 형태: [{ id, category, name, mode, value, primitive, scopes, alpha }]
router.get("/", (req, res) => {
  const { tokens, meta, warnings } = getTokenIndex();
  res.json({ tokens, meta, warnings });
});

export default router;
