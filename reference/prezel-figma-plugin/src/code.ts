// Plugin main thread. Reads the current selection and exports images — never
// mutates any existing node or page.
//
// The one exception is the "Figma로 핸드오프" action: it writes new nodes
// (a cloned copy of the selected frame, the device screenshot, QA text) but
// ONLY onto a dedicated "Design QA Handoff" page that this plugin owns and
// creates itself. It never touches the page/frame the actual design lives
// on — the source frame is cloned, not moved or edited.

export {}; // makes this file a module so it doesn't share global scope with ui.ts

const HANDOFF_PAGE_NAME = "Design QA Handoff";
// Fixed draw width — matches ui.ts's TARGET_IMPL_WIDTH_DP and the density
// calibration target, so export/handoff/calibration all stay consistent.
const TARGET_IMPL_WIDTH_DP = 360;

figma.showUI(__html__, { width: 1100, height: 800 });

async function sendSelectedFrame() {
  const selection = figma.currentPage.selection;

  if (selection.length !== 1) {
    figma.ui.postMessage({ type: "figma-selection", frame: null });
    return;
  }

  const node = selection[0];
  const exportable = "exportAsync" in node ? (node as SceneNode & ExportMixin) : null;

  if (!exportable) {
    figma.ui.postMessage({ type: "figma-selection", frame: null });
    return;
  }

  try {
    const bytes = await exportable.exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: 1 },
    });
    figma.ui.postMessage({
      type: "figma-selection",
      frame: {
        id: node.id,
        name: node.name,
        bytes: Array.from(bytes),
        width: node.width,
        height: node.height,
      },
    });
  } catch (err) {
    figma.ui.postMessage({
      type: "figma-selection",
      frame: null,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

figma.on("selectionchange", () => {
  sendSelectedFrame();
});

// Send the current selection once on load, in case something is already selected.
sendSelectedFrame();

const CHIP_COLOR: RGB = { r: 0x18 / 255, g: 0xa0 / 255, b: 0xfb / 255 };

// A single tag chip: pill-shaped auto-layout frame hugging its text label.
function createChipFrame(label: string): FrameNode {
  const chip = figma.createFrame();
  chip.layoutMode = "HORIZONTAL";
  chip.primaryAxisSizingMode = "AUTO";
  chip.counterAxisSizingMode = "AUTO";
  chip.paddingLeft = chip.paddingRight = 10;
  chip.paddingTop = chip.paddingBottom = 4;
  chip.cornerRadius = 999;
  chip.fills = [{ type: "SOLID", color: CHIP_COLOR }];
  chip.name = `chip-${label}`;

  const text = figma.createText();
  text.fontName = { family: "Inter", style: "Regular" };
  text.fontSize = 12;
  text.characters = label;
  text.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  chip.appendChild(text);
  return chip;
}

// One QA row: chips + text, laid out horizontally, hugging content — mirrors
// the chip+text style used in the plugin's own QA list UI.
function createQaRow(item: { tags: string[]; text: string }): FrameNode {
  const row = figma.createFrame();
  row.layoutMode = "HORIZONTAL";
  row.primaryAxisSizingMode = "AUTO";
  row.counterAxisSizingMode = "AUTO";
  row.counterAxisAlignItems = "CENTER";
  row.itemSpacing = 12;
  row.fills = [];
  row.name = "qa-item";

  for (const tag of item.tags) {
    row.appendChild(createChipFrame(tag));
  }

  const text = figma.createText();
  text.fontName = { family: "Inter", style: "Regular" };
  text.fontSize = 16;
  text.characters = item.text || "(내용 없음)";
  text.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
  row.appendChild(text);

  return row;
}

// Vertical auto-layout stack of QA rows — hugs both axes so the container
// sizes itself to whatever content the rows produce.
function buildQaContainer(qaItems: { tags: string[]; text: string }[]): FrameNode {
  const container = figma.createFrame();
  container.layoutMode = "VERTICAL";
  container.primaryAxisSizingMode = "AUTO";
  container.counterAxisSizingMode = "AUTO";
  container.itemSpacing = 12;
  container.fills = [];
  container.name = "QA 항목";

  if (qaItems.length === 0) {
    const empty = figma.createText();
    empty.fontName = { family: "Inter", style: "Regular" };
    empty.fontSize = 16;
    empty.characters = "(작성된 QA 항목 없음)";
    container.appendChild(empty);
  } else {
    for (const item of qaItems) {
      container.appendChild(createQaRow(item));
    }
  }

  return container;
}

// Clones the selected frame + drops the device screenshot + QA notes onto the
// dedicated handoff page. Re-reads selection fresh (not a stale reference)
// since time has passed since the frame was last exported to the UI.
async function handoffToFigma(implImageBytes: number[], qaItems: { tags: string[]; text: string }[]) {
  const selection = figma.currentPage.selection;
  if (selection.length !== 1) {
    figma.ui.postMessage({ type: "handoff-result", ok: false, error: "Figma에서 프레임 1개를 다시 선택해주세요" });
    return;
  }

  const sourceNode = selection[0];
  if (!("clone" in sourceNode) || typeof (sourceNode as any).clone !== "function") {
    figma.ui.postMessage({ type: "handoff-result", ok: false, error: "선택한 노드는 복제할 수 없는 타입입니다" });
    return;
  }

  try {
    let handoffPage = figma.root.children.find(
      (p): p is PageNode => p.type === "PAGE" && p.name === HANDOFF_PAGE_NAME
    );
    if (!handoffPage) {
      handoffPage = figma.createPage();
      handoffPage.name = HANDOFF_PAGE_NAME;
    }

    await figma.loadFontAsync({ family: "Inter", style: "Regular" });

    // Clone (not move) the source frame — the original design is untouched.
    const clonedFrame = (sourceNode as SceneNode & { clone(): SceneNode }).clone();
    clonedFrame.name = `${sourceNode.name} (QA 비교용 복사본)`;
    handoffPage.appendChild(clonedFrame);

    const bytes = new Uint8Array(implImageBytes);
    const image = figma.createImage(bytes);
    const { width: imgWidth, height: imgHeight } = await image.getSizeAsync();

    // Fix the screenshot's width to TARGET_IMPL_WIDTH_DP and scale height to
    // match, preserving the emulator's native aspect ratio exactly. Never
    // references the cloned frame's size.
    const implScale = imgWidth / TARGET_IMPL_WIDTH_DP;
    const implWidth = TARGET_IMPL_WIDTH_DP;
    const implHeight = imgHeight / implScale;

    const implRect = figma.createRectangle();
    implRect.resize(implWidth, implHeight);
    implRect.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" }];
    implRect.name = "구현 화면 (캡처, 360px 폭 고정)";
    handoffPage.appendChild(implRect);

    // Stack each handoff run below the previous ones rather than overlapping.
    const gap = 40;
    const baseY = handoffPage.children.length > 3 ? handoffPage.children.length * 200 : 0;
    implRect.x = 0;
    implRect.y = baseY;
    clonedFrame.x = implWidth + gap;
    clonedFrame.y = baseY;

    const qaContainer = buildQaContainer(qaItems);
    handoffPage.appendChild(qaContainer);
    qaContainer.x = 0;
    qaContainer.y = baseY + Math.max(implHeight, clonedFrame.height) + gap;

    const group = figma.group([implRect, clonedFrame, qaContainer], handoffPage);
    group.name = `QA ${new Date().toISOString()}`;

    figma.currentPage = handoffPage;
    figma.viewport.scrollAndZoomIntoView([group]);

    figma.ui.postMessage({ type: "handoff-result", ok: true });
  } catch (err) {
    figma.ui.postMessage({
      type: "handoff-result",
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

figma.ui.onmessage = (msg) => {
  if (msg.type === "close") {
    figma.closePlugin();
  } else if (msg.type === "handoff-to-figma") {
    handoffToFigma(msg.implImageBytes, msg.qaItems);
  }
};
