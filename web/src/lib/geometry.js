// 기하 유틸 — px↔dp 환산, bounds, 스케일 계산.

// px → dp : dp = px / (density / 160)
export function pxToDp(px, density) {
  if (!density) return null;
  return px / (density / 160);
}
// 타이포 표기 변환 (px 기준값 → dp). 안드로이드는 sp≈dp(폰트 배율 1 가정).
export function formatTypoUnit(px, density) {
  if (px == null) return null;
  const dp = pxToDp(px, density);
  return dp == null ? px : Number(dp.toFixed(1));
}

// 메모 핀이 붙는 지점 — 점 메모는 그 점, 영역 메모는 영역의 우측 하단.
// 좌상단에 붙이면 핀과 카드가 정작 지적하려는 영역을 덮는다.
export function notePinAt(pos) {
  return { x: pos.x + (pos.w || 0), y: pos.y + (pos.h || 0) };
}

// 두 점 픽셀 거리
export function pixelDistance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// 디바이스 폭 기준 "폭 맞춤" 스케일 (figma px → device px)
export function fitWidthScale(deviceWidthPx, figmaWidthPx) {
  if (!figmaWidthPx) return 1;
  return deviceWidthPx / figmaWidthPx;
}
