// uiautomator dump XML → 노드 배열. 순수 함수 (§7).
// Compose 주의: 노드가 병합돼 적게(또는 비어) 나올 수 있음 → 빈 배열이어도 정상.
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

// "[0,63][1080,210]" → { left, top, right, bottom, width, height }
export function parseBounds(str) {
  if (typeof str !== "string") return null;
  const m = str.match(/\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/);
  if (!m) return null;
  const [, l, t, r, b] = m.map(Number);
  return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t };
}

// XML 문자열 → [{ bounds, resourceId, class, text, contentDesc, ...일부 플래그 }]
export function parseHierarchy(xml) {
  if (!xml || typeof xml !== "string" || !xml.includes("<")) return [];
  let doc;
  try {
    doc = parser.parse(xml);
  } catch {
    return []; // 파싱 실패해도 throw 하지 않음
  }

  const nodes = [];
  const root = doc?.hierarchy ?? doc;
  walk(root, nodes);
  return nodes;
}

function walk(node, out) {
  if (!node || typeof node !== "object") return;

  // 현재 노드가 실제 UI 노드면 수집
  if ("@_bounds" in node || "@_class" in node || "@_resource-id" in node) {
    const bounds = parseBounds(node["@_bounds"]);
    out.push({
      bounds,
      resourceId: node["@_resource-id"] || "",
      class: node["@_class"] || "",
      text: node["@_text"] || "",
      contentDesc: node["@_content-desc"] || "",
      // testTag 가 resource-id 로 노출되면 컴포넌트 식별에 활용
      testTag: extractTestTag(node["@_resource-id"] || ""),
      clickable: node["@_clickable"] === "true",
    });
  }

  // 자식 <node> 재귀 (단일/배열 모두)
  const children = node.node;
  if (Array.isArray(children)) children.forEach((c) => walk(c, out));
  else if (children) walk(children, out);
}

// "com.app:id/myTag" → "myTag"
function extractTestTag(resId) {
  if (!resId) return "";
  const i = resId.indexOf("/");
  return i >= 0 ? resId.slice(i + 1) : resId;
}
