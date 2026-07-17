// 축소(compact) 뷰 — 기기 캡처 + 선택한 Figma 화면 2개만 나란히.
// 기기 캡처를 클릭하면 그 지점에 QA 메모를 남길 수 있다(NotesLayer 재사용).
import { useRef, useState, useLayoutEffect } from "react";
import { useCompare } from "../../state/CompareContext.jsx";
import { CONSTANTS } from "../../config/constants.js";
import CaptureSaveDialog from "../controls/CaptureSaveDialog.jsx";
import NotesLayer from "./NotesLayer.jsx";

export default function CompactView({ onExpand }) {
  const c = useCompare();
  return (
    <div className="compact-view">
      <button className="compact-capture primary" onClick={c.requestCapture} disabled={c.busy} title="기기 화면을 다시 캡처">
        ● 화면 캡처
      </button>
      <button className="compact-toggle" onClick={onExpand} title="원래 화면으로">↔ 확대</button>
      {/* 재캡처 시 저장 안 된 메모가 있으면 확인 — 전체 뷰와 동일 흐름 */}
      <CaptureSaveDialog />
      <div className="compact-imgs">
        <figure>
          <figcaption>기기 캡처{c.deviceImg && c.captureSessionId ? " · 클릭해 메모" : ""}</figcaption>
          <DevicePane />
        </figure>
        <figure>
          <figcaption>Figma</figcaption>
          {c.figmaImg ? <img src={c.figmaImg} alt="Figma 선택" /> : <div className="compact-ph">Figma 선택 없음</div>}
        </figure>
      </div>
    </div>
  );
}

// 기기 캡처 + 메모 레이어. 이미지를 컨테이너에 맞춰 축소해 그리고, 클릭 좌표를
// device-natural 픽셀로 환산해 notePending 을 세팅한다(NotesLayer 가 폼/핀을 그림).
function DevicePane() {
  const c = useCompare();
  const boxRef = useRef(null);
  const [nat, setNat] = useState(null); // {w,h} 자연 크기
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    if (!c.deviceImg) { setNat(null); return; }
    const img = new Image();
    img.onload = () => setNat({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = c.deviceImg;
  }, [c.deviceImg]);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!nat || !el) return;
    const fit = () => setScale(Math.min(el.clientWidth / nat.w, el.clientHeight / nat.h) || 1);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [nat]);

  // 드래그 제스처 상태 — 전체 뷰의 annotation 도구와 동일한 규칙.
  // 클릭(임계값 미만)이면 지점 메모, 드래그면 영역 메모.
  const gesture = useRef(null);

  const toNat = (e, el) => {
    const r = el.getBoundingClientRect();
    const clamp = (v, max) => Math.max(0, Math.min(max, v));
    return { x: clamp((e.clientX - r.left) / scale, nat.w), y: clamp((e.clientY - r.top) / scale, nat.h) };
  };

  const onDown = (e) => {
    if (!nat || !c.captureSessionId) return;
    if (e.target.closest && e.target.closest(".note-pin, .note-card")) return; // 기존 핀/카드 조작
    const p = toNat(e, e.currentTarget);
    gesture.current = { start: p, rect: { x: p.x, y: p.y, w: 0, h: 0 } };
    c.setRegion({ ...gesture.current.rect, dragging: true });
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    const g = gesture.current;
    if (!g) return;
    const p = toNat(e, e.currentTarget);
    g.rect = {
      x: Math.min(g.start.x, p.x), y: Math.min(g.start.y, p.y),
      w: Math.abs(p.x - g.start.x), h: Math.abs(p.y - g.start.y),
    };
    c.setRegion({ ...g.rect, dragging: true });
  };
  const onUp = (e) => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    c.setRegion(null);
    const t = CONSTANTS.noteDragThresholdPx;
    if (g.rect.w < t && g.rect.h < t) c.setNotePending({ x: g.start.x, y: g.start.y }); // 클릭 — 지점
    else c.setNotePending(g.rect); // 드래그 — 영역
  };

  const w = nat ? nat.w * scale : 0;
  const h = nat ? nat.h * scale : 0;

  return (
    <div className="compact-device-box" ref={boxRef}>
      <div
        className="compact-device-inner"
        style={{ width: w, height: h }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        <img src={c.deviceImg} alt="기기 캡처" draggable={false} />
        {/* 드래그 중 영역 미리보기 */}
        {c.region && (
          <div
            className="note-region pending"
            style={{ position: "absolute", pointerEvents: "none",
              left: c.region.x * scale, top: c.region.y * scale,
              width: c.region.w * scale, height: c.region.h * scale }}
          />
        )}
        {nat && <NotesLayer view={{ displayScale: scale }} />}
      </div>
    </div>
  );
}
