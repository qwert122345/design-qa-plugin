// 중앙 대조 캔버스 — 레지스트리(modes/tools)만 읽어 렌더. (§7)
import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useCompare } from "../../state/CompareContext.jsx";
import { MODES, getMode } from "./modes/index.js";
import { TOOLS, getTool } from "./tools/index.js";
import { fitWidthScale } from "../../lib/geometry.js";
import { CONSTANTS } from "../../config/constants.js";
import { imageToCtx } from "../../lib/pixels.js";
import NotesLayer from "./NotesLayer.jsx";
import QuickSaveDialog from "../controls/QuickSaveDialog.jsx";
import CaptureStorage from "../controls/CaptureStorage.jsx";
import CaptureTrash from "../controls/CaptureTrash.jsx";

// 후보 값들 중 threshold 이내로 가장 가까운 값이 있으면 그 값으로 스냅
function snapTo(value, candidates, threshold) {
  let best = value;
  let bestDist = threshold;
  for (const c of candidates) {
    const d = Math.abs(value - c);
    if (d <= bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

export default function CompareCanvas() {
  const c = useCompare();
  const stageRef = useRef(null);
  const deviceRef = useRef(null); // 화면상 device <img> (좌표 매핑용)
  const figmaRef = useRef(null);
  const gestureRef = useRef({}); // 자/메모 다단계 제스처 상태
  const dragRef = useRef(null); // 피그마 레이어 드래그 시작점 { x, y, ox, oy }

  const [natD, setNatD] = useState(null); // device natural {w,h}
  const [natF, setNatF] = useState(null); // figma natural {w,h}
  const [displayScale, setDisplayScale] = useState(1);
  // 정렬: 각 축은 "free"(수동) 또는 앵커. free 면 offset 을 사용자가 직접 제어.
  const [alignX, setAlignX] = useState("free"); // free | left | center | right
  const [alignY, setAlignY] = useState("free"); // free | top | center | bottom
  // 폭 맞춤 / dp 맞춤 — 누른 버튼이 다시 누르기 전까지 활성 표시로 남는다.
  const [fitMode, setFitMode] = useState(null); // "width" | "dp" | null

  // 이미지 자연 크기 선로딩
  useEffect(() => {
    if (!c.deviceImg) return setNatD(null);
    const img = new Image();
    img.onload = () => setNatD({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = c.deviceImg;
  }, [c.deviceImg]);
  useEffect(() => {
    if (!c.figmaImg) return setNatF(null);
    const img = new Image();
    img.onload = () => setNatF({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = c.figmaImg;
  }, [c.figmaImg]);

  // 표시 스케일: device 를 스테이지 높이에 맞춤
  useEffect(() => {
    if (!natD || !stageRef.current) return;
    const fit = () => {
      const h = stageRef.current.clientHeight - 24;
      setDisplayScale(Math.min(1, h / natD.h));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [natD]);

  // 폭 맞춤 스케일 (figma natural → device natural)
  const fitScale = useMemo(
    () => (natD && natF ? fitWidthScale(natD.w, natF.w) : 1),
    [natD, natF]
  );

  // dp 맞춤: 1 design-dp = 1 device-dp 가 되도록 fineScale 계산.
  //   design 폭(dp) = figma natural / figmaExportScale,  device 폭(dp) = natD.w / (density/160)
  //   fineScale = designWidthDp / deviceWidthDp  (예: 360 / 411 ≈ 0.876)
  const density = c.deviceStatus?.density;
  const canDpMatch = !!(natD && natF && density);
  const dpMatch = useCallback(() => {
    if (!canDpMatch) return;
    const designWidthDp = natF.w / CONSTANTS.figmaExportScale;
    const deviceWidthDp = natD.w / (density / 160);
    const fs = designWidthDp / deviceWidthDp;
    c.setFineScale(Number(fs.toFixed(4)));
    // 정렬이 free 인 축만 0 으로 리셋. 앵커 지정된 축은 아래 effect 가 재계산.
    c.setOffset((o) => ({ x: alignX === "free" ? 0 : o.x, y: alignY === "free" ? 0 : o.y }));
  }, [canDpMatch, natD, natF, density, alignX, alignY, c]);

  // 정렬 앵커에 맞춰 offset 자동 계산 (free 면 건드리지 않음).
  //   figma 표시폭(device px) = natD.w × fineScale,  표시높이 = natF.h × fitScale × fineScale
  //   scale 이 바뀌어도 앵커에 붙어 있도록 fineScale 변화에 반응.
  useEffect(() => {
    if (alignX === "free" || !natD) return;
    const figmaW = natD.w * c.fineScale;
    const x =
      alignX === "left" ? 0 :
      alignX === "center" ? Math.round((natD.w - figmaW) / 2) :
      Math.round(natD.w - figmaW); // right
    c.setOffset((o) => ({ ...o, x }));
  }, [alignX, c.fineScale, natD]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (alignY === "free" || !natD || !natF) return;
    const figmaH = natF.h * fitScale * c.fineScale;
    const y =
      alignY === "top" ? 0 :
      alignY === "center" ? Math.round((natD.h - figmaH) / 2) :
      Math.round(natD.h - figmaH); // bottom
    c.setOffset((o) => ({ ...o, y }));
  }, [alignY, c.fineScale, natD, natF, fitScale]); // eslint-disable-line react-hooks/exhaustive-deps

  const view = {
    device: { url: c.deviceImg, w: natD?.w || 0, h: natD?.h || 0 },
    figma: { url: c.figmaImg, w: natF?.w || 0, h: natF?.h || 0 },
    fitScale,
    fineScale: c.fineScale,
    offset: c.offset,
    overlayOpacity: c.overlayOpacity,
    displayScale,
    figmaCursor: c.tool ? "default" : "grab",
  };

  // offset px → dp (density 없으면 px 그대로 표시)
  const dpFactor = c.deviceStatus?.density ? c.deviceStatus.density / 160 : 1;
  const offsetDp = { x: Math.round(c.offset.x / dpFactor), y: Math.round(c.offset.y / dpFactor) };

  // ── 피그마 레이어 드래그 이동 ─────────────────
  const handleFigmaPointerDown = useCallback(
    (e) => {
      if (c.tool) return; // 도구 사용 중엔 드래그 대신 도구 동작
      e.stopPropagation();
      dragRef.current = { x: e.clientX, y: e.clientY, ox: c.offset.x, oy: c.offset.y };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [c.tool, c.offset]
  );
  const handleFigmaPointerMove = useCallback(
    (e) => {
      if (!dragRef.current) return;
      const dx = (e.clientX - dragRef.current.x) / displayScale;
      const dy = (e.clientY - dragRef.current.y) / displayScale;
      let x = dragRef.current.ox + dx;
      let y = dragRef.current.oy + dy;

      // 기기 화면 좌/가운데/우, 상/가운데/하 경계에 가까우면 스냅
      if (natD) {
        const figmaW = natD.w * c.fineScale;
        const figmaH = natF ? natF.h * fitScale * c.fineScale : 0;
        const snapPx = CONSTANTS.dragSnapPx / displayScale;
        x = snapTo(x, [0, (natD.w - figmaW) / 2, natD.w - figmaW], snapPx);
        y = snapTo(y, [0, (natD.h - figmaH) / 2, natD.h - figmaH], snapPx);
      }
      c.setOffset({ x, y });
    },
    [displayScale, c, natD, natF, fitScale]
  );
  const handleFigmaPointerUp = useCallback((e) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, []);
  const figmaDragHandlers = {
    onPointerDown: handleFigmaPointerDown,
    onPointerMove: handleFigmaPointerMove,
    onPointerUp: handleFigmaPointerUp,
  };

  // 드래그/정렬로 바뀐 오프셋을 초기화
  const resetOffset = useCallback(() => {
    c.setOffset({ x: 0, y: 0 });
    setAlignX("free");
    setAlignY("free");
  }, [c]);

  // ── 좌표 매핑 & 도구 헬퍼 ─────────────────────
  const toDeviceNatural = useCallback(
    (e, clamp = false) => {
      const el = deviceRef.current;
      if (!el || !natD) return null;
      const r = el.getBoundingClientRect();
      let x = (e.clientX - r.left) / displayScale;
      let y = (e.clientY - r.top) / displayScale;
      if (clamp) {
        x = Math.max(0, Math.min(natD.w, x));
        y = Math.max(0, Math.min(natD.h, y));
      } else if (x < 0 || y < 0 || x > natD.w || y > natD.h) return null;
      return { x, y };
    },
    [displayScale, natD]
  );

  const deviceToFigmaNatural = useCallback(
    (dx, dy) => {
      const s = fitScale * c.fineScale;
      if (!s || !natF) return null;
      const fx = (dx - c.offset.x) / s;
      const fy = (dy - c.offset.y) / s;
      if (fx < 0 || fy < 0 || fx > natF.w || fy > natF.h) return null;
      return { x: fx, y: fy };
    },
    [fitScale, c.fineScale, c.offset, natF]
  );

  const isTextAt = useCallback(
    (x, y) =>
      (c.hierarchy || []).some(
        (n) =>
          n.bounds &&
          /text|edittext/i.test(n.class || "") &&
          x >= n.bounds.left && x <= n.bounds.right &&
          y >= n.bounds.top && y <= n.bounds.bottom
      ),
    [c.hierarchy]
  );

  const helper = {
    toDeviceNatural,
    deviceToFigmaNatural,
    isTextAt,
    deviceImgEl: deviceRef.current,
    figmaImgEl: figmaRef.current,
    density: c.deviceStatus?.density,
    tokens: c.tokens,
    colorMode: c.colorMode,
    gesture: gestureRef.current,
    set: { pick: c.setPickResult, ruler: c.setRulerResult, region: c.setRegion, notePending: c.setNotePending },
  };

  // ── 포인터 이벤트 → 활성 도구로 디스패치 ────────
  const activeTool = getTool(c.tool);
  const dispatch = (name) => (e) => {
    if (!activeTool) return;
    activeTool.handlers[name]?.(helper, e);
  };

  // 방향키 미세 이동 — 단, 글자를 치는 중이면 방향키는 그쪽 것이다.
  // window 리스너라 메모 textarea·파일키 입력·프레임 검색창에서도 다 걸린다.
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName)) return;
      const map = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (map[e.key]) {
        e.preventDefault();
        const [dx, dy] = map[e.key];
        c.nudge(dx * CONSTANTS.nudgeStepPx, dy * CONSTANTS.nudgeStepPx);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [c]);

  const mode = getMode(c.viewMode);
  const ModeComponent = mode.Component;
  const hasBoth = natD && natF;
  const hasDevice = !!natD;

  return (
    <>
      <Toolbar
        c={c}
        mode={mode}
        dpMatch={dpMatch}
        canDpMatch={canDpMatch}
        hasFigma={!!(natD && natF)}
        alignX={alignX} setAlignX={setAlignX}
        alignY={alignY} setAlignY={setAlignY}
        fitMode={fitMode} setFitMode={setFitMode}
      />
      <div
        className="canvas-stage"
        ref={stageRef}
        onPointerDown={dispatch("onDown")}
        onPointerMove={dispatch("onMove")}
        onPointerUp={dispatch("onUp")}
      >
        {!hasDevice && (
          <div className="hint" style={{ margin: "auto" }}>
            좌측 <b>화면 캡처</b> 로 디바이스 스크린샷을 불러오세요.
          </div>
        )}
        {hasDevice && (
          <div className="canvas-host" style={{ position: "relative", cursor: activeTool?.cursor || "default" }}>
            <ModeComponent view={view} deviceRef={deviceRef} figmaRef={figmaRef} figmaDragHandlers={figmaDragHandlers} />
            <Overlays c={c} view={view} />
            <Magnifier c={c} view={view} deviceRef={deviceRef} />
            <NotesLayer view={view} />
            {!natF && (
              <div className="hint" style={{ position: "absolute", bottom: 4, left: 4 }}>
                Figma 프레임을 선택하면 겹쳐 비교됩니다.
              </div>
            )}
            {hasBoth && (c.offset.x !== 0 || c.offset.y !== 0) && (
              <div className="reset-fab">
                <span className="mono dim">x{offsetDp.x} y{offsetDp.y}dp</span>
                <button onClick={resetOffset} title="드래그/정렬로 이동한 오프셋을 초기화합니다">↺ Reset</button>
              </div>
            )}
          </div>
        )}
      </div>
      {activeTool && <div className="hint">{activeTool.help}</div>}
    </>
  );
}

// ── 상단 툴바 ─────────────────────────────────
function Toolbar({ c, mode, dpMatch, canDpMatch, hasFigma, alignX, setAlignX, alignY, setAlignY, fitMode, setFitMode }) {
  const [storageOpen, setStorageOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const noteTool = TOOLS.find((t) => t.key === "note");
  return (
    <div className="canvas-toolbar">
      {/* 보기 모드 */}
      <div className="chip-row">
        {MODES.map((m) => (
          <button key={m.key} className={c.viewMode === m.key ? "active" : ""} onClick={() => c.setViewMode(m.key)}>
            {m.label}
          </button>
        ))}
      </div>

      {/* 구조 보기 — 도구가 아니라 보기 토글이다(다른 도구와 같이 켤 수 있다).
          hierarchy 가 비면(Compose) 켜도 보여줄 게 없으니 막는다. */}
      <button
        className={c.showBlueprint ? "active" : ""}
        disabled={!c.hierarchy?.length}
        title={c.hierarchy?.length ? "기기 화면의 레이아웃 경계" : "이 화면은 구조 정보가 없습니다 (Compose)"}
        onClick={() => c.setShowBlueprint(!c.showBlueprint)}
      >
        구조
      </button>

      <span className="toolbar-sep" />

      {/* 도구 (메모는 우측 그룹으로 이동) */}
      <div className="chip-row">
        {TOOLS.filter((t) => t.key !== "note").map((t) => (
          <button
            key={t.key}
            className={c.tool === t.key ? "active" : ""}
            onClick={() => c.setTool(c.tool === t.key ? null : t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <span className="toolbar-sep" />

      {/* 불투명도 (겹치기 모드) */}
      {mode.usesOpacity && (
        <label style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
          불투명
          <input
            type="range" min="0" max="1" step="0.05"
            value={c.overlayOpacity}
            style={{ width: 80 }}
            onChange={(e) => c.setOverlayOpacity(Number(e.target.value))}
          />
        </label>
      )}
      {/* 미세 scale */}
      <label style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
        scale
        <input
          type="range"
          min={CONSTANTS.fineScale.min}
          max={CONSTANTS.fineScale.max}
          step={CONSTANTS.fineScale.step}
          value={c.fineScale}
          style={{ width: 80 }}
          onChange={(e) => c.setFineScale(Number(e.target.value))}
        />
        <span className="mono dim" style={{ width: 34, textAlign: "right" }}>
          {c.fineScale.toFixed(3)}
        </span>
      </label>

      <span className="toolbar-sep" />

      {/* 폭 맞춤 + 설명 툴팁 */}
      <span className="infotip-wrap">
        <button
          className={fitMode === "width" ? "active" : ""}
          onClick={() => {
            c.setFineScale(1);
            setAlignX("free");
            setAlignY("free");
            c.setOffset({ x: 0, y: 0 });
            setFitMode((m) => (m === "width" ? null : "width"));
          }}
        >
          폭 맞춤
        </button>
        <InfoTip title="폭 맞춤 (fit-width)">
          Figma 레이어를 <b>기기 폭에 꽉 채웁니다</b> (fineScale=1). 디자인과 기기의 폭이
          다르면 요소가 늘어나 <b>실제보다 크게</b> 보입니다 (예: 360dp→411dp 면 약 1.14배).
          화면을 꽉 채워 <b>전체 레이아웃·비율</b>을 훑을 때 사용.
        </InfoTip>
      </span>
      {/* dp 맞춤 + 설명 툴팁 */}
      <span className="infotip-wrap">
        <button
          className={fitMode === "dp" ? "active" : ""}
          disabled={!canDpMatch}
          onClick={() => {
            dpMatch();
            setFitMode((m) => (m === "dp" ? null : "dp"));
          }}
        >
          dp 맞춤
        </button>
        <InfoTip title="dp 맞춤 (1 design-dp = 1 device-dp)">
          Figma 를 <b>실제 dp 크기 그대로</b> 보여줍니다 (fineScale≈0.876). 디자인 폭이 좁으면
          화면을 다 못 채워 한쪽에 여백이 생기는데, 그게 디자인(360dp)이 기기(411dp)보다
          좁다는 사실을 그대로 나타냅니다. <b>크기·간격 스펙 검증(QA)의 기본</b>.
        </InfoTip>
      </span>

      <span className="toolbar-sep" />

      {/* 정렬 (아이콘) — 가로 좌/가운데/우, 세로 위/가운데/아래. 드래그로 옮긴 뒤 스냅용 */}
      <AlignControls
        hasFigma={hasFigma}
        alignX={alignX} setAlignX={setAlignX}
        alignY={alignY} setAlignY={setAlignY}
      />

      {/* 메모 도구 + 메모 저장/저장소 — 우측 끝에 고정(constraint: right) */}
      <span className="toolbar-sep" style={{ marginLeft: "auto" }} />
      <div className="chip-row">
        <button
          className={c.tool === noteTool.key ? "active" : ""}
          onClick={() => c.setTool(c.tool === noteTool.key ? null : noteTool.key)}
        >
          {noteTool.label}
        </button>
        <button onClick={c.requestSave} disabled={!c.captureSessionId || c.busy}>
          메모 저장
        </button>
        <button onClick={() => setStorageOpen(true)}>저장소</button>
        <button onClick={() => setTrashOpen(true)} title="지운 캡처 — 복원할 수 있습니다">
          휴지통
        </button>
      </div>
      <QuickSaveDialog />
      <CaptureStorage open={storageOpen} onClose={() => setStorageOpen(false)} />
      <CaptureTrash open={trashOpen} onClose={() => setTrashOpen(false)} />
    </div>
  );
}

// ── 설명 툴팁: 호버하면 보이고, 클릭하면 고정(다시 클릭 전까지 유지) ──
function InfoTip({ title, children }) {
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const show = pinned || hover;
  return (
    <span
      className="infotip"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        className={"info-btn" + (pinned ? " active" : "")}
        aria-label="설명 보기"
        onClick={() => setPinned((p) => !p)}
      >
        ⓘ
      </button>
      {show && (
        <div className="tooltip" role="tooltip">
          {pinned && (
            <button className="tooltip-close" onClick={() => setPinned(false)} aria-label="닫기">×</button>
          )}
          {title && <div className="tooltip-title">{title}</div>}
          <div>{children}</div>
        </div>
      )}
    </span>
  );
}

// ── 정렬 아이콘 버튼: 가로 좌/가운데/우 + 세로 위/가운데/아래 ──
const ALIGN_X = [["left", "좌측 정렬"], ["center", "가로 가운데 정렬"], ["right", "우측 정렬"]];
const ALIGN_Y = [["top", "위 정렬"], ["center", "세로 가운데 정렬"], ["bottom", "아래 정렬"]];

function AlignControls({ hasFigma, alignX, setAlignX, alignY, setAlignY }) {
  // 같은 값 다시 누르면 free(수동)로 해제
  const toggle = (cur, set, val) => set(cur === val ? "free" : val);
  const btn = (axis, cur, set, v, label) => (
    <button
      key={axis + v}
      type="button"
      className={"align-btn" + (cur === v ? " active" : "")}
      title={label}
      aria-label={label}
      disabled={!hasFigma}
      onClick={() => toggle(cur, set, v)}
    >
      <AlignIcon type={axis + "-" + v} />
    </button>
  );
  return (
    <div className="align-group">
      {ALIGN_X.map(([v, label]) => btn("h", alignX, setAlignX, v, label))}
      <span className="toolbar-sep" />
      {ALIGN_Y.map(([v, label]) => btn("v", alignY, setAlignY, v, label))}
    </div>
  );
}

// 정렬 아이콘 SVG (기준선 + 정렬된 두 막대 메타포)
function AlignIcon({ type }) {
  const c = "currentColor";
  const paths = {
    "h-left": [["1", "1", "1.6", "14"], ["3.2", "4", "9", "3"], ["3.2", "9", "6", "3"]],
    "h-center": [["7.2", "1", "1.6", "14"], ["3", "4", "10", "3"], ["4.5", "9", "7", "3"]],
    "h-right": [["13.4", "1", "1.6", "14"], ["4", "4", "9", "3"], ["7", "9", "6", "3"]],
    "v-top": [["1", "1", "14", "1.6"], ["4", "3.2", "3", "9"], ["9", "3.2", "3", "6"]],
    "v-center": [["1", "7.2", "14", "1.6"], ["4", "3", "3", "10"], ["9", "4.5", "3", "7"]],
    "v-bottom": [["1", "13.4", "14", "1.6"], ["4", "4", "3", "9"], ["9", "7", "3", "6"]],
  };
  const rects = paths[type] || [];
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      {rects.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="0.5" fill={c} opacity={i === 0 ? 1 : 0.75} />
      ))}
    </svg>
  );
}

// ── 오버레이: 메모 드래그 사각형 / 자 선 / 스포이드 마커 / hierarchy 박스 ──
function Overlays({ c, view }) {
  const s = view.displayScale;
  const px = (v) => v * s;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* hierarchy 감지 박스 — "구조" 토글로만. 메모 도구에 딸려 나오면 메모 남길 때마다
          화면이 온통 파란 박스가 돼서, 정작 지적하려는 것이 안 보인다. */}
      {c.showBlueprint &&
        (c.hierarchy || []).map((n, i) =>
          n.bounds ? (
            <div key={i} style={{
              position: "absolute",
              left: px(n.bounds.left), top: px(n.bounds.top),
              width: px(n.bounds.width), height: px(n.bounds.height),
              border: "1px solid rgba(41,116,255,.4)",
            }} />
          ) : null
        )}
      {/* 메모 드래그 중인 영역 사각형 (미리보기) — 채움 없이 헤어라인만.
          시료 위에 반투명 색을 덮으면 그 아래 색이 물들어 스포이드 판정이 틀어진다. */}
      {c.region && (
        <div style={{
          position: "absolute",
          left: px(c.region.x), top: px(c.region.y),
          width: px(c.region.w), height: px(c.region.h),
          border: "1px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,.5)",
        }} />
      )}
      {/* 자 선 */}
      {c.rulerResult?.first && c.rulerResult?.second && (
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <line
            x1={px(c.rulerResult.first.x)} y1={px(c.rulerResult.first.y)}
            x2={px(c.rulerResult.second.x)} y2={px(c.rulerResult.second.y)}
            stroke="var(--warn)" strokeWidth="2"
          />
        </svg>
      )}
      {/* 스포이드 마커 */}
      {c.pickResult?.at && (
        <div style={{
          position: "absolute",
          left: px(c.pickResult.at.x) - 5, top: px(c.pickResult.at.y) - 5,
          width: 10, height: 10, borderRadius: "50%",
          border: "2px solid #fff", boxShadow: "0 0 0 1px #000",
        }} />
      )}
    </div>
  );
}

// ── 스포이드 확대 미리보기(돋보기) — 드래그로 찍는 동안만 표시 ──
function Magnifier({ c, view, deviceRef }) {
  const canvasRef = useRef(null);
  const p = c.pickResult;
  const show = c.tool === "eyedropper" && p?.dragging && p?.at;
  const { sourceSize, zoom } = CONSTANTS.magnifier;
  const half = Math.floor(sourceSize / 2);
  const size = sourceSize * zoom;

  useEffect(() => {
    if (!show) return;
    const srcCtx = imageToCtx(deviceRef.current);
    const canvas = canvasRef.current;
    if (!srcCtx || !canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(
      srcCtx.canvas,
      Math.round(p.at.x) - half, Math.round(p.at.y) - half, sourceSize, sourceSize,
      0, 0, size, size
    );
  }, [show, p?.at?.x, p?.at?.y, deviceRef, half, sourceSize, size]);

  if (!show) return null;
  const s = view.displayScale;
  return (
    <div className="magnifier" style={{ left: p.at.x * s + 16, top: p.at.y * s + 16 }}>
      <div className="magnifier-canvas-wrap" style={{ width: size, height: size }}>
        <canvas ref={canvasRef} width={size} height={size} />
        <div className="magnifier-center" style={{ left: half * zoom, top: half * zoom, width: zoom, height: zoom }} />
      </div>
      {p.device && (
        <div className="magnifier-info">
          <span className="swatch" style={{ background: p.device.hex }} />
          <b className="mono">{p.device.hex}</b>
        </div>
      )}
    </div>
  );
}
