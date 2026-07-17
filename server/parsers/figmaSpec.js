// figma 노드 → 정제 스펙. 순수 함수 (§7).
import { normalizeHex } from "./tokens/color.js";

// figma color(0~1 컴포넌트) → #AARRGGBB (토큰과 동일 기준)
export function figmaColorToHex(color, opacity = 1) {
  if (!color) return null;
  const to255 = (x) => Math.round(Math.max(0, Math.min(1, x)) * 255);
  const rr = to255(color.r).toString(16).padStart(2, "0");
  const gg = to255(color.g).toString(16).padStart(2, "0");
  const bb = to255(color.b).toString(16).padStart(2, "0");
  const a = color.a != null ? color.a : 1;
  return normalizeHex(`#${rr}${gg}${bb}`.toUpperCase(), a * opacity);
}

// SOLID fill 들의 hex 목록
function extractFills(node) {
  const fills = Array.isArray(node.fills) ? node.fills : [];
  return fills
    .filter((f) => f.visible !== false && f.type === "SOLID")
    .map((f) => figmaColorToHex(f.color, f.opacity != null ? f.opacity : 1))
    .filter(Boolean);
}

// FRAME/COMPONENT 트리 순회 → { id, name, page } 목록 (드롭다운용)
export function collectFrames(fileNode) {
  const out = [];
  const doc = fileNode?.document;
  if (!doc) return out;
  for (const page of doc.children || []) {
    walkFrames(page, page.name, out);
  }
  return out;
}
function walkFrames(node, pageName, out) {
  if (!node) return;
  if (node.type === "FRAME" || node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
    out.push({ id: node.id, name: node.name, page: pageName, type: node.type });
  }
  for (const c of node.children || []) walkFrames(c, pageName, out);
}

// 프레임 하위 INSTANCE/COMPONENT → { id, name, componentId, bounds } (컴포넌트 선택용)
export function collectChildren(frameNode) {
  const out = [];
  walkChildren(frameNode, out);
  return out;
}
function walkChildren(node, out) {
  if (!node) return;
  if (node.type === "INSTANCE" || node.type === "COMPONENT") {
    out.push({
      id: node.id,
      name: node.name,
      componentId: node.componentId || null,
      bounds: node.absoluteBoundingBox || null,
    });
  }
  for (const c of node.children || []) walkChildren(c, out);
}

// 노드 상세 → 정제 스펙 (우측 스펙 패널 / Dev Mode 유사)
// stylesMap: 파일 응답 최상위 styles 맵 (id → {name, styleType})
export function refineSpec(node, stylesMap = {}) {
  if (!node) return null;
  const box = node.absoluteBoundingBox || null;

  const spec = {
    id: node.id,
    name: node.name,
    type: node.type,
    // W/H
    width: box?.width ?? null,
    height: box?.height ?? null,
    bounds: box,
    // 색
    fills: extractFills(node),
    // autolayout padding / itemSpacing
    padding:
      node.paddingLeft != null || node.paddingTop != null
        ? {
            left: node.paddingLeft ?? 0,
            right: node.paddingRight ?? 0,
            top: node.paddingTop ?? 0,
            bottom: node.paddingBottom ?? 0,
          }
        : null,
    itemSpacing: node.itemSpacing ?? null,
    // 텍스트 스타일
    text: null,
    // 스타일 이름 (모든 플랜 가능)
    styles: resolveStyleNames(node.styles, stylesMap),
  };

  // 텍스트 노드면 타이포 스펙 (자간은 반드시 여기서 — 토큰엔 없음, §5.4)
  if (node.type === "TEXT" && node.style) {
    const st = node.style;
    spec.text = {
      characters: node.characters ?? null,
      fontFamily: st.fontFamily ?? null,
      fontWeight: st.fontWeight ?? null,
      fontSize: st.fontSize ?? null,
      lineHeightPx: st.lineHeightPx ?? null,
      // letterSpacing: figma 는 px 로 준다. %는 fontSize 기준 환산.
      letterSpacing: st.letterSpacing ?? 0,
      letterSpacingPct:
        st.letterSpacing != null && st.fontSize
          ? Number(((st.letterSpacing / st.fontSize) * 100).toFixed(2))
          : null,
      textColor: extractFills(node)[0] ?? null,
    };
  }

  return spec;
}

function resolveStyleNames(styles, stylesMap) {
  if (!styles || typeof styles !== "object") return null;
  const out = {};
  for (const [role, styleId] of Object.entries(styles)) {
    const meta = stylesMap[styleId];
    out[role] = meta ? { id: styleId, name: meta.name, styleType: meta.styleType } : { id: styleId };
  }
  return out;
}
