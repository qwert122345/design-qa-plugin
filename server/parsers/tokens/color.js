// 색 토큰 파서 (§5.1) — 순수 함수.
// 입력: DTCG color 파일 JSON + { kind, mode } 메타.
// 출력: 통합 토큰 형태의 배열.
//
// 색 정규화 규칙(중요):
//  - hex 6자리(#RRGGBB) + 별도 alpha(0~1) → alpha 를 8bit 로 바꿔 #AARRGGBB 로 합침.
//  - hex 8자리는 Figma #RRGGBBAA 순서 → #AARRGGBB 로 재배열.
//  - 비교/표시 기준은 #AARRGGBB 로 통일.
import { collectLeaves, readModeName } from "./_leaves.js";

// alpha(0~1) → 2자리 hex
function alphaToHex(a) {
  const n = Math.round(clamp01(a) * 255);
  return n.toString(16).padStart(2, "0").toUpperCase();
}
const clamp01 = (x) => Math.max(0, Math.min(1, Number(x)));

// #RRGGBB(+alpha) 또는 #RRGGBBAA → #AARRGGBB. 실패 시 null.
export function normalizeHex(hex, alpha) {
  if (typeof hex !== "string") return null;
  let h = hex.trim().replace(/^#/, "").toUpperCase();
  if (!/^[0-9A-F]+$/.test(h)) return null;

  if (h.length === 6) {
    // #RRGGBB + 별도 alpha
    const aa = alphaToHex(alpha == null ? 1 : alpha);
    return `#${aa}${h}`;
  }
  if (h.length === 8) {
    // Figma #RRGGBBAA → #AARRGGBB 재배열
    const rgb = h.slice(0, 6);
    const aa = h.slice(6, 8);
    return `#${aa}${rgb}`;
  }
  if (h.length === 3) {
    // #RGB 축약형 방어적 처리
    const rgb = h.split("").map((c) => c + c).join("");
    const aa = alphaToHex(alpha == null ? 1 : alpha);
    return `#${aa}${rgb}`;
  }
  return null;
}

export function parseColorFile(json, { kind, mode } = {}) {
  const modeName = mode || readModeName(json) || null;
  const leaves = collectLeaves(json);

  return leaves.map((leaf) => {
    const v = leaf.value || {};
    const ext = leaf.ext || {};
    const scopes = ext["com.figma.scopes"] || [];
    const primitive = ext["com.figma.aliasData"]?.targetVariableName ?? null;
    const alpha = typeof v.alpha === "number" ? v.alpha : 1;

    const value = normalizeHex(v.hex, alpha);
    const unresolved = value == null; // hex 없음(예: magenta 미해결) → 미해결 표시

    return {
      id: `color:${modeName}:${kind}:${leaf.name}`,
      category: "color",
      kind: kind || null,
      name: leaf.name,
      mode: modeName,
      value, // #AARRGGBB (또는 null)
      primitive, // 예: "Blue/500" (표시용, 없을 수 있음)
      scopes, // 예: ["TEXT_FILL"], ["ALL_SCOPES"]
      alpha,
      unresolved,
    };
  });
}
