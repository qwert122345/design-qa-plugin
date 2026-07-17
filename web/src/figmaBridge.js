// Figma 플러그인 브리지 — UI(iframe) ↔ code.ts(메인 스레드) 사이의 postMessage.
// 웹 dev 모드(플러그인 호스트 없음)에선 조용히 no-op: 선택 push 가 안 올 뿐이다.
//
// 두 방향:
//  1) code.ts → UI 자동 push: Figma 선택이 바뀌면 프레임 이미지+메타+children.
//  2) UI → code.ts 요청/응답: 특정 노드(자식 컴포넌트) 이미지 export.

// number[] (code.ts 가 Uint8Array 를 배열로 직렬화) → objectURL
function bytesToObjectUrl(bytes) {
  const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
  return URL.createObjectURL(blob);
}

// ── code.ts → UI: 선택 push 구독 ──────────────────────────────
// handler({ frame: {id,name,width,height}|null, imageUrl, children: [{id,name}] })
let selectionHandler = null;
export function onFigmaSelection(handler) {
  selectionHandler = handler;
}

// ── UI → code.ts: 노드 이미지 요청 (reqId 로 응답 매칭) ─────────
const pending = new Map();
let reqSeq = 0;

window.addEventListener("message", (e) => {
  const msg = e.data && e.data.pluginMessage;
  if (!msg) return;

  if (msg.type === "figma-selection") {
    selectionHandler &&
      selectionHandler({
        frame: msg.frame || null,
        imageUrl: msg.frame && msg.imageBytes ? bytesToObjectUrl(msg.imageBytes) : null,
        children: msg.children || [],
      });
  } else if (msg.type === "figma-node-image" && pending.has(msg.reqId)) {
    const resolve = pending.get(msg.reqId);
    pending.delete(msg.reqId);
    resolve(msg.imageBytes ? bytesToObjectUrl(msg.imageBytes) : null);
  }
});

// 특정 노드 이미지 요청 → objectURL (없으면 null)
export function exportFigmaNode(nodeId) {
  return new Promise((resolve) => {
    const reqId = ++reqSeq;
    pending.set(reqId, resolve);
    parent.postMessage({ pluginMessage: { type: "export-node", reqId, nodeId } }, "*");
  });
}
