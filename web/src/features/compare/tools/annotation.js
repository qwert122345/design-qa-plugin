// 메모 — 클릭하면 지점에, 드래그하면 영역에 QA 메모를 남깁니다.
import { CONSTANTS } from "../../../config/constants.js";

export const annotation = {
  key: "note",
  label: "메모",
  cursor: "crosshair",
  help: "클릭하면 지점에, 드래그하면 영역에 메모를 남깁니다.",
  handlers: {
    onDown(h, e) {
      const p = h.toDeviceNatural(e);
      if (!p) return;
      h.gesture.start = p;
      h.gesture.dragging = true;
      h.gesture.rect = { x: p.x, y: p.y, w: 0, h: 0 };
      h.set.region({ ...h.gesture.rect, dragging: true });
    },
    onMove(h, e) {
      const s = h.gesture;
      if (!s.dragging || !s.start) return;
      const p = h.toDeviceNatural(e, true); // clamp
      if (!p) return;
      s.rect = {
        x: Math.min(s.start.x, p.x),
        y: Math.min(s.start.y, p.y),
        w: Math.abs(p.x - s.start.x),
        h: Math.abs(p.y - s.start.y),
      };
      h.set.region({ ...s.rect, dragging: true });
    },
    onUp(h) {
      const s = h.gesture;
      if (!s.dragging || !s.start) return;
      s.dragging = false;
      h.set.region(null);
      const rect = s.rect || { x: s.start.x, y: s.start.y, w: 0, h: 0 };
      const { noteDragThresholdPx: t } = CONSTANTS;
      if (rect.w < t && rect.h < t) {
        h.set.notePending({ x: s.start.x, y: s.start.y }); // 클릭 — 점 메모
      } else {
        h.set.notePending(rect); // 드래그 — 영역 메모
      }
      s.start = null;
      s.rect = null;
    },
  },
};
