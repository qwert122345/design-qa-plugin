// 튜닝값은 이 파일 한 곳에 모은다. (§7)
export const CONSTANTS = {
  // 색 토큰 역검색 — 가까운 순으로 몇 개까지 후보로 보여줄지
  color: {
    candidateCount: 5,
  },
  // 간격 대조 허용오차 (dp)
  spacing: {
    toleranceDp: 1, // ±1dp
  },
  // figma 이미지 export scale (더 이상 사용자가 고를 수 없음 — 고정값)
  figmaExportScale: 2,
  // 타이포 값 표기 단위 (라벨)
  defaultUnit: "dp",
  // 오버레이 기본 불투명도
  defaultOverlayOpacity: 0.5,
  // 미세 scale 슬라이더 범위. 폭이 다른 디자인(예: 360dp 디자인 vs 411dp 기기)의
  // dp 맞춤(≈0.876)까지 내려갈 수 있도록 0.8~1.2 로 넓힘.
  fineScale: { min: 0.8, max: 1.2, step: 0.001 },
  // 방향키 미세이동 픽셀
  nudgeStepPx: 1,
  // 기본 모드(Normal=라이트 / Inverse=다크)
  defaultMode: "Normal",
  // 피그마 레이어 드래그 시 기기 화면 경계(좌/우/상/하/가운데) 스냅 임계값(화면 px)
  dragSnapPx: 10,
  // 스포이드 확대 미리보기: 원본에서 읽을 픽셀 크기(정사각) × 확대 배율
  magnifier: { sourceSize: 11, zoom: 9 },
  // QA 메모 카테고리 — 순서가 드롭다운 표시 순서
  noteCategories: ["Color", "Text", "Image", "Layout", "Motion"],
  defaultNoteCategory: "Text",
  // 메모 도구: 이 값(원본 px) 미만으로 움직이면 클릭(점 메모), 이상이면 드래그(영역 메모)
  noteDragThresholdPx: 8,
};
