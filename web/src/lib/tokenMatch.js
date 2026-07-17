// 토큰 역검색/판정 (§6) — 순수 함수.
import { deltaE } from "./color.js";
import { CONSTANTS } from "../config/constants.js";

// 텍스트 위를 찍었을 때 후보 필터에 쓰는 scope 집합
const TEXT_SCOPES = ["TEXT_FILL", "ALL_FILLS", "ALL_SCOPES"];

// 색 역검색: 현재 모드의 색 토큰 중 가까운 순으로 상위 N개 + 상대 확률(%).
// opts: { mode, onText }  (onText=true 면 TEXT_FILL 계열만)
// 확률은 ΔE 역수 가중치를 후보들 사이에서 정규화한 값 — "이 중 어느 게 유력한가"를 보여주기 위함이지
// 절대적인 통계적 확률은 아니다.
export function matchColor(hex, tokens, opts = {}) {
  const { mode, onText = false } = opts;
  let candidates = tokens.filter(
    (t) => t.category === "color" && t.value && (!mode || t.mode === mode)
  );
  if (onText) {
    candidates = candidates.filter((t) =>
      (t.scopes || []).some((s) => TEXT_SCOPES.includes(s))
    );
  }
  const ranked = candidates
    .map((token) => ({ token, deltaE: deltaE(hex, token.value) }))
    .sort((a, b) => a.deltaE - b.deltaE)
    .slice(0, CONSTANTS.color.candidateCount);

  const weights = ranked.map((r) => 1 / (1 + r.deltaE));
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  const list = ranked.map((r, i) => ({
    token: r.token,
    deltaE: r.deltaE,
    probability: Math.round((weights[i] / totalWeight) * 100),
  }));

  return { candidates: list, count: candidates.length };
}

// 간격 매칭: spacing/radius/stroke 셋에서 ±toleranceDp 로.
export function matchSpacing(dp, tokens, opts = {}) {
  const { category = null, toleranceDp = CONSTANTS.spacing.toleranceDp } = opts;
  const candidates = tokens.filter(
    (t) =>
      ["spacing", "radius", "stroke"].includes(t.category) &&
      t.value != null &&
      (!category || t.category === category)
  );
  let best = null;
  let bestDiff = Infinity;
  for (const t of candidates) {
    const diff = Math.abs(t.value - dp);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = t;
    }
  }
  const within = best && bestDiff <= toleranceDp;
  return { best, diff: bestDiff, within };
}

// 타이포 매칭: figma 텍스트 스펙 → 가장 잘 맞는 조립표 스타일.
// figmaText: { fontFamily, fontWeight, fontSize, lineHeightPx }
export function matchTypography(figmaText, tokens) {
  if (!figmaText) return { best: null };
  const styles = tokens.filter((t) => t.category === "typography");
  let best = null;
  let bestScore = -1;
  for (const t of styles) {
    const v = t.value;
    let score = 0;
    if (v.size === Math.round(figmaText.fontSize)) score += 2;
    if (v.lineHeight === Math.round(figmaText.lineHeightPx)) score += 2;
    if (v.weight === figmaText.fontWeight) score += 1;
    if (v.font && figmaText.fontFamily && v.font === figmaText.fontFamily) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  // size+lineHeight 둘 다 맞아야 확정(exact)
  const exact = best && best.value.size === Math.round(figmaText.fontSize) &&
    best.value.lineHeight === Math.round(figmaText.lineHeightPx);
  return { best, score: bestScore, exact };
}
