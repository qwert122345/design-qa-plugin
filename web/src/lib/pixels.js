// 캔버스 픽셀 추출 — 이미지 원본 픽셀 좌표 기준으로 색을 읽는다(스케일 영향 없음, §9).

// HTMLImageElement 를 오프스크린 캔버스에 원본 크기로 그려 컨텍스트 반환(캐시).
const _ctxCache = new WeakMap();
export function imageToCtx(img) {
  if (!img || !img.naturalWidth) return null;
  if (_ctxCache.has(img)) return _ctxCache.get(img);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  _ctxCache.set(img, ctx);
  return ctx;
}

// 원본 픽셀 좌표(x,y)의 색 → { r,g,b,a } (0~255) 또는 null
export function pickPixel(img, x, y) {
  const ctx = imageToCtx(img);
  if (!ctx) return null;
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= ctx.canvas.width || py >= ctx.canvas.height) return null;
  const d = ctx.getImageData(px, py, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2], a: d[3] };
}
