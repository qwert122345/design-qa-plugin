// 3분할 레이아웃. 좌/우 패널은 드래그로 폭 조절 가능(로컬 저장).
import { useState, useCallback, useEffect, useRef } from "react";
import ControlsPanel from "./features/controls/ControlsPanel.jsx";
import CompareCanvas from "./features/compare/CompareCanvas.jsx";
import SpecPanel from "./features/spec/SpecPanel.jsx";
import { useCompare } from "./state/CompareContext.jsx";

const MIN_PANE = 220;
const MAX_PANE = 640;
const clamp = (v) => Math.min(MAX_PANE, Math.max(MIN_PANE, v));

export default function App() {
  const { error } = useCompare();
  const [leftW, setLeftW] = useState(() => Number(localStorage.getItem("qa.leftW")) || 300);
  const [rightW, setRightW] = useState(() => Number(localStorage.getItem("qa.rightW")) || 320);

  useEffect(() => localStorage.setItem("qa.leftW", leftW), [leftW]);
  useEffect(() => localStorage.setItem("qa.rightW", rightW), [rightW]);

  return (
    <div className="app" style={{ gridTemplateColumns: `${leftW}px 4px 1fr 4px ${rightW}px` }}>
      <aside className="pane">
        <ControlsPanel />
      </aside>
      <Resizer onDrag={(dx) => setLeftW((w) => clamp(w + dx))} />
      <main className="pane center">
        {error && <div className="err" style={{ padding: "6px 12px" }}>⚠ {error}</div>}
        <CompareCanvas />
      </main>
      <Resizer onDrag={(dx) => setRightW((w) => clamp(w - dx))} />
      <aside className="pane">
        <SpecPanel />
      </aside>
    </div>
  );
}

// 패널 사이 드래그 핸들 — dx(px)를 그때그때 onDrag 로 전달.
function Resizer({ onDrag }) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onPointerDown = useCallback((e) => {
    dragging.current = true;
    lastX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);
  const onPointerMove = useCallback(
    (e) => {
      if (!dragging.current) return;
      onDrag(e.clientX - lastX.current);
      lastX.current = e.clientX;
    },
    [onDrag]
  );
  const onPointerUp = useCallback((e) => {
    dragging.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, []);

  return (
    <div
      className="resizer"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}
