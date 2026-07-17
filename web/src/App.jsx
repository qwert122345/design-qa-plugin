// 3분할 레이아웃. 좌/우 패널은 드래그로 폭 조절(로컬 저장).
// 창 우하단 핸들로 플러그인 창 자체 크기 조절(figma.ui.resize). "축소" 버튼은
// 기기 캡처 + 선택한 Figma 화면 2개만 보이는 컴팩트 뷰로 전환(크기 조절 잠금).
import { useState, useCallback, useEffect, useRef } from "react";
import ControlsPanel from "./features/controls/ControlsPanel.jsx";
import CompareCanvas from "./features/compare/CompareCanvas.jsx";
import CompactView from "./features/compare/CompactView.jsx";
import SpecPanel from "./features/spec/SpecPanel.jsx";
import { useCompare } from "./state/CompareContext.jsx";
import { resizeWindow } from "./figmaBridge.js";

const MIN_PANE = 220;
const MAX_PANE = 640;
const clamp = (v) => Math.min(MAX_PANE, Math.max(MIN_PANE, v));

// Figma 플러그인 UI 는 data: URL 로 로드돼 localStorage 접근이 SecurityError 를
// 던진다("Storage is disabled inside 'data:' URLs"). 안 되면 조용히 무시.
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* data: URL — 저장 불가 */ } },
};

// 창 크기 — full 기본값 / compact 고정값 / 조절 한계
const FULL_DEFAULT = { w: 1280, h: 860 };
const COMPACT = { w: 720, h: 600 };
const WIN_MIN = { w: 520, h: 400 };
const WIN_MAX = { w: 1600, h: 1100 };
const clampWin = (w, h) => ({
  w: Math.round(Math.min(WIN_MAX.w, Math.max(WIN_MIN.w, w))),
  h: Math.round(Math.min(WIN_MAX.h, Math.max(WIN_MIN.h, h))),
});

export default function App() {
  const { error } = useCompare();
  const [leftW, setLeftW] = useState(() => Number(store.get("qa.leftW")) || 300);
  const [rightW, setRightW] = useState(() => Number(store.get("qa.rightW")) || 320);
  const [compact, setCompact] = useState(false);
  const [winSize, setWinSize] = useState(() => ({
    w: Number(store.get("qa.winW")) || FULL_DEFAULT.w,
    h: Number(store.get("qa.winH")) || FULL_DEFAULT.h,
  }));

  useEffect(() => store.set("qa.leftW", leftW), [leftW]);
  useEffect(() => store.set("qa.rightW", rightW), [rightW]);
  useEffect(() => { store.set("qa.winW", winSize.w); store.set("qa.winH", winSize.h); }, [winSize]);

  // 로드 시 기억한 full 크기로 창 맞춤
  useEffect(() => { if (!compact) resizeWindow(winSize.w, winSize.h); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCompact = useCallback(() => {
    setCompact((prev) => {
      const next = !prev;
      if (next) resizeWindow(COMPACT.w, COMPACT.h);
      else resizeWindow(winSize.w, winSize.h);
      return next;
    });
  }, [winSize]);

  // ── 창 크기 조절 핸들 (우하단) — figma.ui.resize ──
  const winDrag = useRef(null);
  const onWinDown = useCallback((e) => {
    winDrag.current = { x: e.clientX, y: e.clientY, w: winSize.w, h: winSize.h };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [winSize]);
  const onWinMove = useCallback((e) => {
    if (!winDrag.current) return;
    const s = clampWin(winDrag.current.w + (e.clientX - winDrag.current.x), winDrag.current.h + (e.clientY - winDrag.current.y));
    setWinSize(s);
    resizeWindow(s.w, s.h);
  }, []);
  const onWinUp = useCallback((e) => {
    winDrag.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, []);

  if (compact) return <CompactView onExpand={toggleCompact} />;

  return (
    <div className="app" style={{ gridTemplateColumns: `${leftW}px 4px 1fr 4px ${rightW}px` }}>
      <button className="compact-toggle" onClick={toggleCompact} title="축소 — 기기/Figma 두 화면만 보기">⊟ 축소</button>
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
      {/* 창 크기 조절 핸들 */}
      <div
        className="win-resize"
        title="드래그하여 창 크기 조절"
        onPointerDown={onWinDown}
        onPointerMove={onWinMove}
        onPointerUp={onWinUp}
      />
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
