// 저장소 내보내기 — 캡처 이미지 위에 QA 메모(핀+카드, 전부 열린 상태)를 그려 PNG Blob 생성.
// note.x/y/w/h 는 이미지 원본 픽셀 좌표라 스케일 보정 없이 그대로 그린다.
// 넘긴 메모만 그린다 — 호출부가 메모를 나눠 넘기면 한 장에 하나씩 나온다.
// 핀 번호는 note.seq(원래 목록에서의 번호)를 쓴다. 없으면 넘어온 순서.

import { notePinAt } from "./geometry.js";

// global.css 의 부스 토큰과 대응하는 하드코딩 값(canvas 는 var() 를 못 읽음).
// 크롬 색을 고치면 여기도 같이 고쳐야 내보낸 PNG 가 화면과 어긋나지 않는다.
const COLORS = {
  panel2: "#2e2e2e", // --chrome-2
  border: "#3d3d3d", // --rule
  text: "#e8e8e8", // --ink
  textDim: "#909090", // --ink-dim
  warn: "#f1c40f", // --warn (계측 데이터라 부스 규칙에서 제외)
  pinText: "#1c1c1c", // --booth
  region: "rgba(241,196,15,.15)",
};
// global.css 의 --cat-* / --chip-ink 와 같은 값이어야 한다.
// 칩 글자를 4색 모두 어두운 잉크로 통일 — 흰 글자는 대비 미달이었다.
const CAT_COLORS = { Color: "#2e77ff", Text: "#2ecc71", Image: "#b366f5", Layout: "#e67e22", Motion: "#ff5c8a" };
const CAT_TEXT = { Color: "#141414", Text: "#141414", Image: "#141414", Layout: "#141414", Motion: "#141414" };

// 화면 CSS px 기준으로 만든 치수를 실제 캡처 해상도에 맞춰 키우는 배율.
// ponytail: 실측 대신 고정값(3)으로 어림잡음 — 캡처 해상도가 극단적으로 다르면 조정 필요.
const EXPORT_SCALE = 3;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}

function drawPin(ctx, x, y, seq, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.warn;
  ctx.fill();
  ctx.lineWidth = r * 0.18;
  ctx.strokeStyle = "#fff";
  ctx.stroke();
  ctx.fillStyle = COLORS.pinText;
  ctx.font = `700 ${r}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(seq), x, y + r * 0.05);
}

function drawCard(ctx, x, y, note, s) {
  const pad = 10 * s;
  const width = 220 * s;
  const chipH = 18 * s;
  const fontSize = 12 * s;
  ctx.font = `${fontSize}px sans-serif`;
  const lines = wrapText(ctx, note.text, width - pad * 2);
  const lineH = fontSize * 1.35;
  const height = pad * 2 + chipH + 6 * s + lines.length * lineH;

  // 캔버스가 곧 캡처 크기라, 가장자리 메모는 카드가 이미지 밖으로 나가 잘린다.
  // 화면의 카드와 같게 — 넘친 만큼 안으로 민다.
  x = Math.max(pad, Math.min(x, ctx.canvas.width - width - pad));
  y = Math.max(pad, Math.min(y, ctx.canvas.height - height - pad));

  ctx.fillStyle = COLORS.panel2;
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = s;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 8 * s);
  ctx.fill();
  ctx.stroke();

  let cy = y + pad;
  if (note.category) {
    ctx.font = `700 ${10 * s}px sans-serif`;
    const chipW = ctx.measureText(note.category).width + 14 * s;
    ctx.fillStyle = CAT_COLORS[note.category] || COLORS.textDim;
    ctx.beginPath();
    ctx.roundRect(x + pad, cy, chipW, chipH, chipH / 2);
    ctx.fill();
    ctx.fillStyle = CAT_TEXT[note.category] || "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(note.category, x + pad + chipW / 2, cy + chipH / 2 + s);
    cy += chipH + 6 * s;
  }

  ctx.fillStyle = COLORS.text;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  cy += fontSize;
  for (const line of lines) {
    ctx.fillText(line, x + pad, cy);
    cy += lineH;
  }
}

// capture: { id }, notes: capturesApi 캡처 하나에 대한 노트 배열
export async function renderCaptureToBlob(imageUrl, notes) {
  const img = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const s = EXPORT_SCALE;
  const pinR = 11 * s;

  notes.forEach((note, i) => {
    if (note.w > 0 || note.h > 0) {
      ctx.fillStyle = COLORS.region;
      ctx.strokeStyle = COLORS.warn;
      ctx.lineWidth = 2 * s;
      ctx.fillRect(note.x, note.y, note.w, note.h);
      ctx.strokeRect(note.x, note.y, note.w, note.h);
    }
    const at = notePinAt(note);
    drawPin(ctx, at.x, at.y, note.seq ?? i + 1, pinR);
    drawCard(ctx, at.x + pinR * 0.6, at.y + pinR + 6 * s, note, s);
  });

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
