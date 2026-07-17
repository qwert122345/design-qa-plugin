// 비교 모드 레지스트리. 새 모드는 여기 등록만 하면 CompareCanvas 가 읽어 렌더. (§7)
import SideBySideMode from "./SideBySideMode.jsx";
import OverlayMode from "./OverlayMode.jsx";

export const MODES = [
  { key: "side", label: "나란히", Component: SideBySideMode },
  { key: "overlay", label: "겹치기", Component: OverlayMode, usesOpacity: true },
];

export const getMode = (key) => MODES.find((m) => m.key === key) || MODES[0];
