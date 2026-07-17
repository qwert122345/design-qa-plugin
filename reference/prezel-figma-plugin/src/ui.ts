// Plugin UI (iframe). Only talks to the local helper server (adb bridge for
// device screenshots). The only write path into Figma is the "Figma에
// 핸드오프" button, which asks code.ts to add content to a dedicated handoff
// page (see code.ts) — the design's own page/frame is never touched.

export {}; // makes this file a module so it doesn't share global scope with code.ts

const HELPER = "http://localhost:4747";
const HANDOFF_PAGE_NAME = "Design QA Handoff";
// Fixed draw width used for both export/handoff scaling and density
// calibration — keeping one constant means both stay consistent.
const TARGET_IMPL_WIDTH_DP = 360;

interface QaItem {
  tags: string[];
  text: string;
}

interface DeviceMetrics {
  density: number;
  scale: number;
  sizePx: { width: number; height: number };
  sizeDp: { width: number; height: number };
}

interface Device {
  id: string;
  model?: string;
  avdName?: string | null;
  metrics: DeviceMetrics | null;
  metricsError?: string | null;
}

// Generic Play Store emulator images report a build-fingerprint model like
// "sdk_gphone16k_arm64" — never a friendly name. Prefer the AVD's own name
// (e.g. "Pixel_6_API_34") when available; it's the closest we can get to
// "Pixel 6" without the user renaming the AVD in Android Studio.
function deviceLabel(d: Device): string {
  const friendly = d.avdName || d.model;
  return friendly ? `${d.id} (${friendly})` : d.id;
}

let currentImplImage: HTMLImageElement | null = null;
let currentFigmaImage: HTMLImageElement | null = null;
let figmaFrameName = "Figma 프레임";
let currentFigmaFrameId: string | null = null;
let liveActive = false;
let devices: Device[] = [];
const qaItems: QaItem[] = [];

function $<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function renderPane(paneId: string, img: HTMLImageElement | null, placeholder: string) {
  const pane = $(paneId);
  pane.innerHTML = "";
  if (img) {
    pane.appendChild(img);
  } else {
    const div = document.createElement("div");
    div.className = "placeholder";
    div.textContent = placeholder;
    pane.appendChild(div);
  }
}

// --- Figma selection (comes from code.ts) ---

window.onmessage = async (event: MessageEvent) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;

  if (msg.type === "figma-selection") {
    if (msg.frame) {
      // A genuinely different frame (by Figma node id, not just re-selecting
      // the same one) means whatever QA notes are on screen were written
      // against the previous frame — clear them so they don't get
      // accidentally attached to the wrong frame.
      if (msg.frame.id !== currentFigmaFrameId) {
        currentFigmaFrameId = msg.frame.id;
        resetQaNotes();
      }
      const bytes = new Uint8Array(msg.frame.bytes);
      const blob = new Blob([bytes], { type: "image/png" });
      currentFigmaImage = await blobToImage(blob);
      figmaFrameName = msg.frame.name;
      $("figma-frame-name").textContent = figmaFrameName;
      $("figma-frame-info").textContent =
        msg.frame.width && msg.frame.height
          ? `${Math.round(msg.frame.width)}x${Math.round(msg.frame.height)}px`
          : "";
      renderPane("figma-pane", currentFigmaImage, "");
    } else {
      currentFigmaImage = null;
      figmaFrameName = "Figma 프레임";
      $("figma-frame-name").textContent = figmaFrameName;
      $("figma-frame-info").textContent = "";
      renderPane(
        "figma-pane",
        null,
        msg.error ? `프레임을 불러오지 못했습니다: ${msg.error}` : "Figma에서 프레임 1개를 선택해주세요"
      );
    }
  } else if (msg.type === "handoff-result") {
    const statusEl = $("export-status");
    statusEl.textContent = msg.ok
      ? `Figma의 "${HANDOFF_PAGE_NAME}" 페이지에 추가했습니다`
      : `Figma 핸드오프 실패: ${msg.error}`;
  }
};

// --- Device list + capture (via local helper server) ---

// Shows the selected device's dp-converted size (informational — export/
// handoff always target a fixed 360 draw width instead of using this).
function updateDeviceInfo() {
  const select = $<HTMLSelectElement>("device-select");
  const infoEl = $("device-info");
  const device = devices.find((d) => d.id === select.value);

  if (!device) {
    infoEl.textContent = "";
    return;
  }

  if (!device.metrics) {
    infoEl.textContent = device.metricsError
      ? `DPI 정보를 가져오지 못했습니다 (${device.metricsError})`
      : "DPI 정보를 가져오지 못했습니다";
    return;
  }

  const { sizeDp } = device.metrics;
  infoEl.textContent = `1x 환산 ${sizeDp.width}x${sizeDp.height}px`;
}

async function fetchDevices(): Promise<Device[]> {
  const res = await fetch(`${HELPER}/devices`);
  if (!res.ok) throw new Error(await res.text());
  const data: { devices: Device[] } = await res.json();
  return data.devices || [];
}

async function loadDevices() {
  const select = $<HTMLSelectElement>("device-select");
  select.innerHTML = `<option value="">불러오는 중...</option>`;
  try {
    devices = await fetchDevices();
    select.innerHTML = "";
    if (devices.length === 0) {
      select.innerHTML = `<option value="">연결된 기기 없음</option>`;
      updateDeviceInfo();
      return;
    }
    for (const d of devices) {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = deviceLabel(d);
      select.appendChild(opt);
    }
    updateDeviceInfo();
  } catch (e) {
    devices = [];
    select.innerHTML = `<option value="">헬퍼 서버 연결 실패 (localhost:4747)</option>`;
    updateDeviceInfo();
  }
}

// Re-fetches device metrics without touching the <select> options, so the
// current selection survives (used after calibrating/resetting density).
async function refreshDeviceMetrics() {
  try {
    devices = await fetchDevices();
  } catch {
    // Keep the existing device list on failure — the calibrate/reset call
    // itself already succeeded or failed independently of this refresh.
  }
  updateDeviceInfo();
}

// POST helper that surfaces the real failure reason instead of a raw JSON
// parse error — e.g. if the helper server hasn't been restarted since this
// endpoint was added, Express's default 404 page is HTML, and blindly
// calling res.json() would throw an opaque "Unexpected token '<'" instead.
async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${HELPER}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `요청 실패 (${res.status} ${res.statusText})`;
    try {
      const errData = await res.json();
      if (errData && errData.error) message = errData.error;
    } catch {
      try {
        const text = await res.text();
        if (text) message = text;
      } catch {
        // keep the status-based fallback
      }
    }
    throw new Error(message);
  }
  return res.json();
}

// Overrides the selected device's display density so its logical width
// becomes exactly TARGET_IMPL_WIDTH_DP — the same width export/handoff draw
// screenshots at — so text sizes actually match Figma's 1x convention
// instead of just visually resembling it. Reversible via resetDeviceDensity.
async function calibrateDeviceDensity() {
  const select = $<HTMLSelectElement>("device-select");
  const deviceId = select.value;
  const infoEl = $("device-info");
  if (!deviceId) {
    infoEl.textContent = "먼저 기기를 선택해주세요";
    return;
  }

  infoEl.textContent = "밀도 계산 및 적용 중...";
  try {
    const data = await postJson<{ density: number; widthPx: number; widthDp: number }>(
      "/calibrate-density",
      { deviceId, targetWidthDp: TARGET_IMPL_WIDTH_DP }
    );
    await refreshDeviceMetrics();
    infoEl.textContent = `밀도 조정 완료 (${data.widthPx}px → ${TARGET_IMPL_WIDTH_DP}dp) · ${infoEl.textContent}`;
  } catch (e) {
    infoEl.textContent = `밀도 맞추기 실패: ${e instanceof Error ? e.message : e}`;
  }
}

async function resetDeviceDensity() {
  const select = $<HTMLSelectElement>("device-select");
  const deviceId = select.value;
  const infoEl = $("device-info");
  if (!deviceId) {
    infoEl.textContent = "먼저 기기를 선택해주세요";
    return;
  }

  infoEl.textContent = "밀도 초기화 중...";
  try {
    await postJson("/reset-density", { deviceId });
    await refreshDeviceMetrics();
  } catch (e) {
    infoEl.textContent = `밀도 초기화 실패: ${e instanceof Error ? e.message : e}`;
  }
}

function stopLive() {
  if (!liveActive) return;
  liveActive = false;
  $<HTMLButtonElement>("live-toggle-btn").textContent = "실시간 보기 시작";
  // Clearing src makes the browser drop the underlying connection, which
  // ends the helper server's streaming loop on its side too.
  const liveImg = document.querySelector<HTMLImageElement>("#impl-pane img.live");
  if (liveImg) liveImg.src = "";
}

function startLive() {
  const select = $<HTMLSelectElement>("device-select");
  const deviceId = select.value;
  if (!deviceId) {
    renderPane("impl-pane", null, "먼저 기기를 선택해주세요");
    return;
  }
  liveActive = true;
  $<HTMLButtonElement>("live-toggle-btn").textContent = "실시간 보기 중지";
  const pane = $("impl-pane");
  pane.innerHTML = "";
  const img = document.createElement("img");
  img.className = "live";
  img.src = `${HELPER}/stream/${encodeURIComponent(deviceId)}?t=${Date.now()}`;
  pane.appendChild(img);
}

function toggleLive() {
  if (liveActive) {
    stopLive();
  } else {
    startLive();
  }
}

// Captures a fresh still frame from the selected device. Called automatically
// right before export/handoff instead of requiring a separate manual capture
// step — the user just points the emulator/device at the right screen and
// clicks export or handoff.
async function captureDeviceImage(): Promise<boolean> {
  const select = $<HTMLSelectElement>("device-select");
  const deviceId = select.value;
  if (!deviceId) {
    renderPane("impl-pane", null, "먼저 기기를 선택해주세요");
    return false;
  }
  stopLive();
  renderPane("impl-pane", null, "캡처 중...");
  try {
    const res = await fetch(`${HELPER}/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    currentImplImage = await blobToImage(blob);
    renderPane("impl-pane", currentImplImage, "");
    return true;
  } catch (e) {
    currentImplImage = null;
    renderPane("impl-pane", null, `캡처 실패: ${e instanceof Error ? e.message : e}`);
    return false;
  }
}

// --- QA chips + list ---

function getActiveChips(): string[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(".chip.active")).map(
    (c) => c.dataset.chip || ""
  );
}

function clearActiveChips() {
  document.querySelectorAll(".chip.active").forEach((c) => c.classList.remove("active"));
}

// Called whenever the Figma selection changes to a different frame — the QA
// notes on screen were written against the previous frame, so start fresh.
function resetQaNotes() {
  qaItems.length = 0;
  renderQaList();
  $<HTMLTextAreaElement>("qa-text").value = "";
  clearActiveChips();
}

function renderQaList() {
  const list = $("qa-list");
  list.innerHTML = "";
  qaItems.forEach((item, idx) => {
    const li = document.createElement("li");

    const tagsDiv = document.createElement("div");
    tagsDiv.className = "tags";
    item.tags.forEach((t) => {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = t;
      tagsDiv.appendChild(span);
    });

    const textDiv = document.createElement("div");
    textDiv.className = "qa-text";
    textDiv.textContent = item.text;

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-item";
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => {
      qaItems.splice(idx, 1);
      renderQaList();
    });

    li.appendChild(tagsDiv);
    li.appendChild(textDiv);
    li.appendChild(removeBtn);
    list.appendChild(li);
  });
}

function addQaItem() {
  const textarea = $<HTMLTextAreaElement>("qa-text");
  const text = textarea.value.trim();
  if (!text) return;
  qaItems.push({ tags: getActiveChips(), text });
  textarea.value = "";
  clearActiveChips();
  renderQaList();
}

// --- Figma handoff (writes only to the dedicated "Design QA Handoff" page —
// see code.ts. Never touches the page/frame the design lives on.) ---

function imageToPngBytes(img: HTMLImageElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("이미지 변환 실패"));
        return;
      }
      blob
        .arrayBuffer()
        .then((buf) => resolve(new Uint8Array(buf)))
        .catch(reject);
    }, "image/png");
  });
}

async function handoffToFigma() {
  const statusEl = $("export-status");

  statusEl.textContent = "구현 화면 캡처 중...";
  const captured = await captureDeviceImage();
  if (!captured || !currentImplImage) {
    statusEl.textContent = "구현 화면 캡처에 실패해 핸드오프를 중단했습니다";
    return;
  }

  statusEl.textContent = "Figma에 붙여넣는 중...";
  try {
    const bytes = await imageToPngBytes(currentImplImage);
    parent.postMessage(
      {
        pluginMessage: {
          type: "handoff-to-figma",
          implImageBytes: Array.from(bytes),
          qaItems,
        },
      },
      "*"
    );
  } catch (e) {
    statusEl.textContent = `Figma 핸드오프 실패: ${e instanceof Error ? e.message : e}`;
  }
}

// --- Export composite PNG (device screenshot scaled by its real DPI, Figma
// frame drawn as exported — never cross-scaled against each other) ---

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function exportComposite() {
  const statusEl = $("export-status");

  if (!currentFigmaImage) {
    statusEl.textContent = "Figma 프레임을 먼저 선택해주세요";
    return;
  }

  statusEl.textContent = "구현 화면 캡처 중...";
  const captured = await captureDeviceImage();
  if (!captured || !currentImplImage) {
    statusEl.textContent = "구현 화면 캡처에 실패해 내보내기를 중단했습니다";
    return;
  }
  const implImg = currentImplImage;
  const figmaImg = currentFigmaImage;

  statusEl.textContent = "내보내는 중...";

  try {
    exportCompositeInner(statusEl, implImg, figmaImg);
  } catch (e) {
    statusEl.textContent = `내보내기 실패: ${e instanceof Error ? e.message : e}`;
  }
}

function exportCompositeInner(
  statusEl: HTMLElement,
  implImg: HTMLImageElement,
  figmaImg: HTMLImageElement
) {
  const padding = 32;
  const gap = 32;
  const headerHeight = 24;
  const qaFontSize = 16;
  const qaLineHeight = 22;
  const qaTitleHeight = 32;

  // Fix the device screenshot's draw width to TARGET_IMPL_WIDTH_DP and scale
  // height to match, preserving the emulator's native aspect ratio exactly.
  // Never references the Figma frame's size — just a fixed target width.
  // Use the "밀도 360dp 맞추기" button so the device actually renders at this
  // logical width, or text sizes won't line up with Figma's 1x convention.
  const implDrawScale = implImg.width / TARGET_IMPL_WIDTH_DP;
  const implDrawWidth = TARGET_IMPL_WIDTH_DP;
  const implDrawHeight = implImg.height / implDrawScale;
  const figmaDrawWidth = figmaImg.width;
  const figmaDrawHeight = figmaImg.height;

  const imagesWidth = implDrawWidth + gap + figmaDrawWidth;
  const imagesMaxHeight = Math.max(implDrawHeight, figmaDrawHeight);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `${qaFontSize}px sans-serif`;

  const qaLines: string[] = [];
  qaItems.forEach((item, i) => {
    const tagsText = item.tags.length ? `[${item.tags.join(", ")}] ` : "";
    const wrapped = wrapText(ctx, `${i + 1}. ${tagsText}${item.text}`, imagesWidth - padding);
    qaLines.push(...wrapped);
  });

  const qaAreaHeight = qaItems.length ? qaTitleHeight + qaLines.length * qaLineHeight : 0;

  canvas.width = imagesWidth + padding * 2;
  canvas.height =
    padding + headerHeight + imagesMaxHeight + (qaItems.length ? gap + qaAreaHeight : 0) + padding;

  // Re-fetch context after resizing (resizing clears state in some browsers)
  const ctx2 = canvas.getContext("2d")!;
  ctx2.fillStyle = "#ffffff";
  ctx2.fillRect(0, 0, canvas.width, canvas.height);

  ctx2.fillStyle = "#1a1a1a";
  ctx2.font = "bold 14px sans-serif";
  ctx2.fillText("구현 화면", padding, padding + 16);
  ctx2.fillText(figmaFrameName, padding + implDrawWidth + gap, padding + 16);

  const imageY = padding + headerHeight;
  ctx2.drawImage(
    implImg,
    padding,
    imageY + (imagesMaxHeight - implDrawHeight) / 2,
    implDrawWidth,
    implDrawHeight
  );
  ctx2.drawImage(
    figmaImg,
    padding + implDrawWidth + gap,
    imageY + (imagesMaxHeight - figmaDrawHeight) / 2,
    figmaDrawWidth,
    figmaDrawHeight
  );

  if (qaItems.length) {
    let y = imageY + imagesMaxHeight + gap;
    ctx2.font = "bold 14px sans-serif";
    ctx2.fillText("QA 항목", padding, y + 16);
    y += qaTitleHeight;
    ctx2.font = `${qaFontSize}px sans-serif`;
    for (const line of qaLines) {
      y += qaLineHeight;
      ctx2.fillText(line, padding, y);
    }
  }

  canvas.toBlob((blob) => {
    if (!blob) {
      statusEl.textContent = `내보내기 실패 (캔버스 크기 ${canvas.width}x${canvas.height} — 이미지가 너무 클 수 있어요)`;
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `design-qa-${timestamp}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    statusEl.textContent = "내보내기 완료";
  }, "image/png");
}

// --- Wire up events ---

document.querySelectorAll<HTMLButtonElement>(".chip").forEach((chip) => {
  chip.addEventListener("click", () => chip.classList.toggle("active"));
});

$("refresh-devices").addEventListener("click", loadDevices);
$("device-select").addEventListener("change", () => {
  stopLive();
  updateDeviceInfo();
});
$("live-toggle-btn").addEventListener("click", toggleLive);
$("calibrate-density-btn").addEventListener("click", calibrateDeviceDensity);
$("reset-density-btn").addEventListener("click", resetDeviceDensity);
$("add-qa-item").addEventListener("click", addQaItem);
$("export-btn").addEventListener("click", exportComposite);
$("handoff-figma-btn").addEventListener("click", handoffToFigma);

loadDevices();
