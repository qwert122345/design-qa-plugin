// Figma 메인 스레드. 선택된 노드를 PNG 로 export + spec(색/간격/타이포/스타일)을
// 뽑아 UI(디자인 QA 앱)로 넘긴다. 어떤 노드도 수정하지 않는다(읽기 전용).
//
// spec 모양은 web SpecPanel 이 기대하는 것과 동일 (원래 서버 figmaSpec.js 를
// 플러그인 노드 API 로 재현). 색은 #AARRGGBB.
//
// 프로토콜(web/src/figmaBridge.js 와 짝):
//  - 선택 변경 자동 push: { type:"figma-selection", frame, imageBytes, children, spec }
//  - UI 의 export-node 요청 응답:   { type:"figma-node-image", reqId, imageBytes, spec }

export {}; // ui 코드와 전역 스코프를 공유하지 않도록 모듈로 만든다

const EXPORT_SCALE = 2; // web CONSTANTS.figmaExportScale 과 동일

figma.showUI(__html__, { width: 1280, height: 860 });

// ── PNG export ────────────────────────────────
async function exportNodePng(node: BaseNode | null): Promise<number[] | null> {
  if (!node || !("exportAsync" in node)) return null;
  try {
    const bytes = await (node as SceneNode & ExportMixin).exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: EXPORT_SCALE },
    });
    return Array.from(bytes);
  } catch {
    return null;
  }
}

// ── spec 추출 (서버 figmaSpec.refineSpec 재현) ──
const hh = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).toUpperCase().padStart(2, "0");
const to255 = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 255);

// figma color(0~1) + opacity → #AARRGGBB
function colorToHex(color: RGB, opacity?: number): string {
  const aa = hh(to255(opacity == null ? 1 : opacity));
  return `#${aa}${hh(to255(color.r))}${hh(to255(color.g))}${hh(to255(color.b))}`;
}

// SOLID fill 들의 #AARRGGBB 목록
function solidFills(node: SceneNode): string[] {
  const fills = (node as GeometryMixin).fills;
  if (!fills || fills === figma.mixed || !Array.isArray(fills)) return [];
  return (fills as readonly Paint[])
    .filter((f) => f.visible !== false && f.type === "SOLID")
    .map((f) => colorToHex((f as SolidPaint).color, (f as SolidPaint).opacity));
}

// 오토레이아웃 padding (아니면 null — REST 동작과 동일)
function paddingOf(node: SceneNode) {
  const n = node as FrameNode;
  if (!("layoutMode" in node) || n.layoutMode === "NONE") return null;
  return { left: n.paddingLeft ?? 0, right: n.paddingRight ?? 0, top: n.paddingTop ?? 0, bottom: n.paddingBottom ?? 0 };
}

function textSpec(node: TextNode) {
  const fontName = node.fontName;
  const fontSize = node.fontSize === figma.mixed ? null : (node.fontSize as number);
  const fontFamily = fontName === figma.mixed ? null : (fontName as FontName).family;
  const fontWeight = node.fontWeight === figma.mixed ? null : (node.fontWeight as number);

  // lineHeight → px (PIXELS 그대로, PERCENT 는 fontSize 기준 환산, AUTO 는 null)
  let lineHeightPx: number | null = null;
  const lh = node.lineHeight;
  if (lh !== figma.mixed) {
    if (lh.unit === "PIXELS") lineHeightPx = lh.value;
    else if (lh.unit === "PERCENT" && fontSize != null) lineHeightPx = Number((fontSize * lh.value / 100).toFixed(2));
  }

  // letterSpacing → px + %(fontSize 기준)
  let letterSpacing = 0;
  let letterSpacingPct: number | null = null;
  const ls = node.letterSpacing;
  if (ls !== figma.mixed) {
    if (ls.unit === "PIXELS") {
      letterSpacing = ls.value;
      letterSpacingPct = fontSize ? Number((ls.value / fontSize * 100).toFixed(2)) : null;
    } else if (ls.unit === "PERCENT") {
      letterSpacingPct = ls.value;
      letterSpacing = fontSize ? Number((fontSize * ls.value / 100).toFixed(2)) : 0;
    }
  }

  return {
    characters: node.characters,
    fontFamily,
    fontWeight,
    fontSize,
    lineHeightPx,
    letterSpacing,
    letterSpacingPct,
    textColor: solidFills(node)[0] ?? null,
  };
}

// styleId → { role: {id, name} } (fill/text/stroke/effect/grid)
async function styleNames(node: SceneNode) {
  const roles: [string, keyof any][] = [
    ["fill", "fillStyleId"],
    ["text", "textStyleId"],
    ["stroke", "strokeStyleId"],
    ["effect", "effectStyleId"],
    ["grid", "gridStyleId"],
  ];
  const out: Record<string, { id: string; name?: string }> = {};
  for (const [role, prop] of roles) {
    const id = (node as any)[prop];
    if (id && id !== figma.mixed && typeof id === "string") {
      try {
        const st = await figma.getStyleByIdAsync(id);
        out[role] = st ? { id, name: st.name } : { id };
      } catch {
        out[role] = { id };
      }
    }
  }
  return Object.keys(out).length ? out : null;
}

async function buildSpec(node: SceneNode) {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    width: node.width,
    height: node.height,
    fills: solidFills(node),
    padding: paddingOf(node),
    itemSpacing:
      "layoutMode" in node && (node as FrameNode).layoutMode !== "NONE"
        ? (node as FrameNode).itemSpacing
        : null,
    text: node.type === "TEXT" ? textSpec(node as TextNode) : null,
    styles: await styleNames(node),
  };
}

// 직접 자식 중 export 가능한 것 → 드롭다운용 목록
function childList(node: SceneNode) {
  return "children" in node
    ? (node as ChildrenMixin).children
        .filter((ch) => "exportAsync" in ch)
        .map((ch) => ({ id: ch.id, name: ch.name }))
    : [];
}

// ── 선택 push ─────────────────────────────────
async function pushSelection() {
  const sel = figma.currentPage.selection;
  if (sel.length !== 1 || !("exportAsync" in sel[0])) {
    figma.ui.postMessage({ type: "figma-selection", frame: null });
    return;
  }
  const node = sel[0];
  const [imageBytes, spec] = await Promise.all([exportNodePng(node), buildSpec(node)]);
  figma.ui.postMessage({
    type: "figma-selection",
    frame: { id: node.id, name: node.name, width: node.width, height: node.height },
    imageBytes,
    children: childList(node),
    spec,
  });
}

figma.on("selectionchange", pushSelection);
pushSelection();

// ── QA 캡처를 이미지 노드로 추가 ("이미지 복사" 대체) ──────────────
// OS 클립보드 이미지 복사는 플러그인(data: URL, 비보안)에서 불가 → 지금 보고 있는
// 페이지의 뷰포트 중앙에 이미지 노드로 넣는다. 기존 노드는 안 건드리고 추가만.
async function addImagesToCurrentPage(images: { bytes: number[]; name?: string }[]) {
  const page = figma.currentPage;
  const center = figma.viewport.center; // 사용자가 지금 보고 있는 위치
  const gap = 32;
  let x = center.x;
  const placed: SceneNode[] = [];
  for (const im of images) {
    const image = figma.createImage(new Uint8Array(im.bytes));
    const { width, height } = await image.getSizeAsync();
    const s = width > 400 ? 400 / width : 1; // 큰 캡처는 폭 400 으로 축소
    const rect = figma.createRectangle();
    rect.resize(Math.round(width * s), Math.round(height * s));
    rect.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" }];
    rect.name = im.name || "QA capture";
    page.appendChild(rect);
    rect.x = x;
    rect.y = center.y;
    x += rect.width + gap;
    placed.push(rect);
  }
  if (placed.length) {
    page.selection = placed; // 바로 Cmd+C 할 수 있게 선택
    figma.viewport.scrollAndZoomIntoView(placed);
  }
  return placed.length;
}

figma.ui.onmessage = async (msg) => {
  if (!msg) return;
  if (msg.type === "close") {
    figma.closePlugin();
  } else if (msg.type === "resize") {
    const w = Math.max(320, Math.min(1600, Math.round(msg.width)));
    const h = Math.max(240, Math.min(1200, Math.round(msg.height)));
    figma.ui.resize(w, h);
  } else if (msg.type === "add-image") {
    try {
      const count = await addImagesToCurrentPage(msg.images || []);
      figma.ui.postMessage({ type: "add-image-result", ok: true, count });
    } catch (e) {
      figma.ui.postMessage({
        type: "add-image-result",
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  } else if (msg.type === "export-node") {
    const node = await figma.getNodeByIdAsync(msg.nodeId);
    const isScene = node && "exportAsync" in node;
    const [imageBytes, spec] = await Promise.all([
      exportNodePng(node),
      isScene ? buildSpec(node as SceneNode) : Promise.resolve(null),
    ]);
    figma.ui.postMessage({ type: "figma-node-image", reqId: msg.reqId, imageBytes, spec });
  }
};
