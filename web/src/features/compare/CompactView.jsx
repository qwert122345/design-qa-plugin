// 축소(compact) 뷰 — 기기 캡처 + 선택한 Figma 화면 2개만 나란히.
// 기기 캡처를 클릭하면 그 지점에 QA 메모를 남길 수 있다(NotesLayer 재사용).
import { useRef, useState, useLayoutEffect } from "react";
import { useCompare } from "../../state/CompareContext.jsx";
import NotesLayer from "./NotesLayer.jsx";

export default function CompactView({ onExpand }) {
  const c = useCompare();
  return (
    <div className="compact-view">
      <button className="compact-toggle" onClick={onExpand} title="원래 화면으로">↔ 확대</button>
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

  if (!c.deviceImg) return <div className="compact-ph">화면 캡처 없음</div>;

  const onClick = (e) => {
    if (!nat || !c.captureSessionId) return;
    // 기존 핀/카드/폼을 조작하는 클릭이면 새 메모를 찍지 않는다.
    if (e.target.closest && e.target.closest(".note-pin, .note-card, .note-region")) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / scale;
    const y = (e.clientY - r.top) / scale;
    if (x < 0 || y < 0 || x > nat.w || y > nat.h) return;
    c.setNotePending({ x, y });
  };

  const w = nat ? nat.w * scale : 0;
  const h = nat ? nat.h * scale : 0;

  return (
    <div className="compact-device-box" ref={boxRef}>
      <div className="compact-device-inner" style={{ width: w, height: h }} onClick={onClick}>
        <img src={c.deviceImg} alt="기기 캡처" draggable={false} />
        {nat && <NotesLayer view={{ displayScale: scale }} />}
      </div>
    </div>
  );
}
