// 스포이드 — 클릭/드래그 좌표의 device/figma 색을 각각 추출 → hex + RGB 차이 + 토큰 역검색(§6).
import { pickPixel } from "../../../lib/pixels.js";
import { rgbToHex, rgbaToAARRGGBB, deltaE } from "../../../lib/color.js";
import { matchColor } from "../../../lib/tokenMatch.js";

const CURSOR = "crosshair";

function pick(h, e, dragging) {
  const p = h.toDeviceNatural(e);
  if (!p) return;

  // device 색 (원본 픽셀)
  const dRgb = pickPixel(h.deviceImgEl, p.x, p.y);
  // figma 대응 좌표 → figma 색
  const f = h.deviceToFigmaNatural(p.x, p.y);
  const fRgb = f ? pickPixel(h.figmaImgEl, f.x, f.y) : null;

  const deviceHex = dRgb ? rgbToHex(dRgb) : null;
  const figmaHex = fRgb ? rgbToHex(fRgb) : null;
  const deviceAARRGGBB = dRgb ? rgbaToAARRGGBB(dRgb) : null;

  // 텍스트 위인지 hierarchy 로 추정 → scope 필터
  const onText = h.isTextAt(p.x, p.y);
  const match = deviceAARRGGBB
    ? matchColor(deviceAARRGGBB, h.tokens, { mode: h.colorMode, onText })
    : null;

  h.set.pick({
    at: p,
    device: dRgb ? { hex: deviceHex, aarrggbb: deviceAARRGGBB, rgb: dRgb } : null,
    figma: fRgb ? { hex: figmaHex, rgb: fRgb } : null,
    deltaE: deviceHex && figmaHex ? deltaE(deviceHex, figmaHex) : null,
    onText,
    match,
    dragging,
  });
}

export const eyedropper = {
  key: "eyedropper",
  label: "스포이드",
  cursor: CURSOR,
  help: "클릭하거나 드래그하며 색을 추출합니다. device/Figma 색과 토큰을 역검색합니다.",
  handlers: {
    onDown(h, e) {
      pick(h, e, true);
    },
    onMove(h, e) {
      if (e.buttons & 1) pick(h, e, true); // 왼쪽 버튼을 누른 채 이동 중일 때만 계속 추출
    },
    onUp(h) {
      h.set.pick((prev) => (prev ? { ...prev, dragging: false } : prev));
    },
  },
};
