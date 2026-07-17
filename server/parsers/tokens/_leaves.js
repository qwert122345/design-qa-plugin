// 공통: DTCG 트리를 재귀 순회하며 `$value` 를 가진 노드를 리프로 수집.
// 리프의 경로를 "/" 로 이어 토큰 이름으로 쓴다. `$extensions` 키는 건너뛴다.
// 순수 함수 — 외부 의존 없음.
export function collectLeaves(tree) {
  const out = [];
  walk(tree, [], out);
  return out;
}

function walk(node, pathParts, out) {
  if (!node || typeof node !== "object") return;
  if (Object.prototype.hasOwnProperty.call(node, "$value")) {
    out.push({
      name: pathParts.join("/"),
      value: node.$value,
      type: node.$type,
      ext: node.$extensions || {},
    });
    return; // 리프에서 멈춘다
  }
  for (const key of Object.keys(node)) {
    if (key === "$extensions" || key === "$type") continue;
    walk(node[key], [...pathParts, key], out);
  }
}

// 파일 최상위 모드명 (예: "Normal" / "Inverse" / "Mode 1")
export function readModeName(tree) {
  return tree?.$extensions?.["com.figma.modeName"] ?? null;
}
