// 자 — 두 점 클릭 → px 거리 + density 로 dp 환산 (+ 간격 토큰 매칭).
import { pixelDistance, pxToDp } from "../../../lib/geometry.js";
import { matchSpacing } from "../../../lib/tokenMatch.js";

export const ruler = {
  key: "ruler",
  label: "자",
  cursor: "crosshair",
  help: "두 점을 클릭하면 px 거리와 dp 환산값을 보여주고 간격 토큰을 매칭합니다.",
  handlers: {
    onDown(h, e) {
      const p = h.toDeviceNatural(e);
      if (!p) return;
      const s = h.gesture;
      if (!s.first) {
        s.first = p;
        h.set.ruler({ first: p, second: null, px: null, dp: null });
      } else {
        const px = pixelDistance(s.first, p);
        const dp = pxToDp(px, h.density);
        const match = dp != null ? matchSpacing(dp, h.tokens) : null;
        h.set.ruler({
          first: s.first,
          second: p,
          px: Number(px.toFixed(1)),
          dp: dp != null ? Number(dp.toFixed(1)) : null,
          match,
        });
        s.first = null; // 다음 측정을 위해 리셋
      }
    },
  },
};
