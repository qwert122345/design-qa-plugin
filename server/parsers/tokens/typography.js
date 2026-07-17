// 타이포 토큰 파서 (§5.3) — 순수 함수.
// 타이포는 Figma Styles 라 Variables JSON 이 없다 → PDF 기반 조립표(typographyStyles.json)를 데이터로 사용.
// Primitive_Text.json 은 참조값(표시용).
//
// 자간(letterSpacing)은 토큰에 없다(§5.4) → 대조 시점에 /api/figma/spec 의 실제 값을 쓴다.
// 여기서는 letterSpacingRef(라벨)만 담는다.
import { collectLeaves } from "./_leaves.js";

// Primitive_Text.json → { family, weight:{Regular:500,...}, size:{100:12,...}, lineHeight:{...} }
export function parsePrimitiveText(json) {
  const leaves = collectLeaves(json);
  const out = { family: null, weight: {}, size: {}, lineHeight: {} };
  for (const leaf of leaves) {
    const [top, key] = leaf.name.split("/");
    if (top === "Family") out.family = leaf.value;
    else if (top === "Weight") out.weight[key] = leaf.value;
    else if (top === "Size") out.size[key] = leaf.value;
    else if (top === "LineHeight") out.lineHeight[key] = leaf.value;
  }
  return out;
}

// typographyStyles.json(배열) → 통합 토큰 배열.
// value 는 조립 스펙 객체. 타이포는 모드 무관(단일).
export function parseTypographyStyles(styles, primitives = null) {
  if (!Array.isArray(styles)) return [];
  return styles.map((s) => {
    const spec = {
      font: s.font ?? primitives?.family ?? null,
      weight: s.weight ?? null,
      size: s.size ?? null,
      lineHeight: s.lineHeight ?? null,
      letterSpacingRef: s.letterSpacingRef ?? null, // 실제 %값은 figma 노드에서
    };
    const unresolved = spec.size == null || spec.lineHeight == null;
    return {
      id: `typography:${s.style}`,
      category: "typography",
      name: s.style,
      mode: null,
      value: spec, // 조립 스펙 객체
      primitive: null,
      scopes: [],
      alpha: null,
      unresolved,
    };
  });
}
