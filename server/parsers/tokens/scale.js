// 간격 토큰 파서 (§5.2) — 순수 함수.
// Semantic_Scale.json (Spacing / Radius / Stroke, 단일 모드).
//  - value = $value (숫자). 단위는 dp 로 간주 (Figma 숫자 = 안드로이드 dp).
//  - primitive = aliasData.targetVariableName (예 "Scale/16").
//  - category 는 최상위 키로 분류: Spacing→spacing, Radius→radius, Stroke→stroke.
import { collectLeaves, readModeName } from "./_leaves.js";

const CATEGORY_BY_TOP = {
  Spacing: "spacing",
  Radius: "radius",
  Stroke: "stroke",
};

export function parseScaleFile(json) {
  const modeName = readModeName(json); // 보통 "Mode 1"
  const leaves = collectLeaves(json);

  return leaves.map((leaf) => {
    const top = leaf.name.split("/")[0];
    const category = CATEGORY_BY_TOP[top] || "spacing";
    const ext = leaf.ext || {};
    const primitive = ext["com.figma.aliasData"]?.targetVariableName ?? null;
    const scopes = ext["com.figma.scopes"] || [];

    const num = typeof leaf.value === "number" ? leaf.value : null;
    const unresolved = num == null;

    return {
      id: `${category}:${leaf.name}`,
      category, // spacing | radius | stroke
      name: leaf.name, // 예: "Spacing/16"
      mode: modeName,
      value: num, // dp 숫자 (또는 null)
      primitive, // 예: "Scale/16"
      scopes,
      alpha: null,
      unresolved,
    };
  });
}
