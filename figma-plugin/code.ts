// Figma 메인 스레드. 선택된 노드를 PNG 로 export 해서 UI(디자인 QA 앱)로 넘긴다.
// 어떤 노드도 수정하지 않는다(읽기 전용) — export 와 selection 읽기만.
//
// 프로토콜(web/src/figmaBridge.js 와 짝):
//  - 선택 변경 시 자동 push: { type:"figma-selection", frame, imageBytes, children }
//  - UI 의 export-node 요청에 응답:   { type:"figma-node-image", reqId, imageBytes }

export {}; // ui 코드와 전역 스코프를 공유하지 않도록 모듈로 만든다

// web CONSTANTS.figmaExportScale 과 동일 — 2x 로 떠서 대조 시 선명하게.
const EXPORT_SCALE = 2;

figma.showUI(__html__, { width: 1280, height: 860 });

async function exportNodePng(node: BaseNode | null): Promise<number[] | null> {
  if (!node || !("exportAsync" in node)) return null;
  try {
    const bytes = await (node as SceneNode & ExportMixin).exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: EXPORT_SCALE },
    });
    return Array.from(bytes);
  } catch (err) {
    return null;
  }
}

// 현재 선택(단일 export 가능 노드)을 UI 로 push. 아니면 frame:null.
async function pushSelection() {
  const sel = figma.currentPage.selection;
  if (sel.length !== 1 || !("exportAsync" in sel[0])) {
    figma.ui.postMessage({ type: "figma-selection", frame: null });
    return;
  }
  const node = sel[0];
  const imageBytes = await exportNodePng(node);
  const children =
    "children" in node
      ? node.children
          .filter((ch) => "exportAsync" in ch)
          .map((ch) => ({ id: ch.id, name: ch.name }))
      : [];

  figma.ui.postMessage({
    type: "figma-selection",
    frame: { id: node.id, name: node.name, width: node.width, height: node.height },
    imageBytes,
    children,
  });
}

figma.on("selectionchange", pushSelection);
pushSelection(); // 로드 시 이미 선택돼 있을 수 있으니 한 번

figma.ui.onmessage = async (msg) => {
  if (!msg) return;
  if (msg.type === "close") {
    figma.closePlugin();
  } else if (msg.type === "export-node") {
    const node = await figma.getNodeByIdAsync(msg.nodeId);
    const imageBytes = await exportNodePng(node);
    figma.ui.postMessage({ type: "figma-node-image", reqId: msg.reqId, imageBytes });
  }
};
