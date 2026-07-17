// 우측 스펙 패널 — 선택된 figma 노드 스펙 + 도구 결과(스포이드/자) + 토큰 판정.
import { useCompare } from "../../state/CompareContext.jsx";
import { matchTypography } from "../../lib/tokenMatch.js";
import { formatTypoUnit } from "../../lib/geometry.js";
import { CONSTANTS } from "../../config/constants.js";
import { CategoryChip, MeasureRow } from "../compare/NotesLayer.jsx";
import { aarrggbbToCss } from "../../lib/color.js";

const copy = (t) => navigator.clipboard?.writeText(t);

export default function SpecPanel() {
  const c = useCompare();
  return (
    <div>
      <PickResult c={c} />
      <RulerResult c={c} />
      <FigmaSpec c={c} />
      <NotesPanel c={c} />
    </div>
  );
}

// ── QA 메모 목록 ────────────────────────────────
function NotesPanel({ c }) {
  if (!c.captureSessionId) return null;
  return (
    <section>
      <h2>QA 메모 · {c.notes.length}</h2>
      {c.notes.length === 0 ? (
        <p className="dim" style={{ fontSize: 11 }}>
          아직 메모가 없습니다. 캔버스 위 "메모" 도구로 지점을 클릭해 추가하세요.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {c.notes.map((n, i) => (
            <div
              key={n.id}
              className="row copyable"
              style={{ alignItems: "flex-start" }}
              onClick={() => c.setActiveNoteId(n.id)}
            >
              <span className="note-pin">{i + 1}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <CategoryChip category={n.category} />
                <div style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{n.text}</div>
                <MeasureRow measure={n.measure} />
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── 스포이드 결과 + 색 토큰 역검색 ──────────────
function PickResult({ c }) {
  const p = c.pickResult;
  if (!p) return null;
  return (
    <section>
      <h2>스포이드 · {c.colorMode}</h2>
      {p.device && (
        <ColorRow label="Device" hex={p.device.hex} sub={`${p.device.rgb.r} ${p.device.rgb.g} ${p.device.rgb.b}`} />
      )}
      {p.figma && (
        <ColorRow label="Figma" hex={p.figma.hex} sub={`${p.figma.rgb.r} ${p.figma.rgb.g} ${p.figma.rgb.b}`} />
      )}
      {p.deltaE != null && (
        <div className="stat" style={{ marginTop: 2 }}>
          <span>Device ↔ Figma</span>
          <b><span className="readout-unit" style={{ marginLeft: 0, marginRight: 4 }}>ΔE</span>{p.deltaE.toFixed(2)}</b>
        </div>
      )}
      {p.match && (
        <>
          <label style={{ marginTop: 12 }}>가까운 토큰{p.onText ? " · 텍스트 scope" : ""}</label>
          {p.match.candidates.length > 0 ? (
            p.match.candidates.map((cand) => (
              <div key={cand.token.id} className="cand">
                {/* 찍은 색 | 토큰 색 — 사이에 아무것도 두지 않는다. 맞닿아야 색차가 보인다. */}
                <span
                  className="split"
                  title={`왼쪽 찍은 색 ${pickedHex(p)} · 오른쪽 ${cand.token.name} ${cand.token.value}`}
                >
                  <i style={{ background: aarrggbbToCss(pickedHex(p)) }} />
                  <i style={{ background: aarrggbbToCss(cand.token.value) }} />
                </span>
                <span className="cand-name" title={cand.token.name}>
                  {cand.token.name}
                  <em>{cand.probability}%</em>
                </span>
                <span className="cand-de">
                  {cand.deltaE.toFixed(1)}<small> ΔE</small>
                </span>
              </div>
            ))
          ) : (
            <span className="dim">후보 토큰 없음</span>
          )}
        </>
      )}
    </section>
  );
}

// 스플릿 스와치 왼쪽에 놓을 "찍은 색" — 역검색은 device 를 기준으로 돈다.
const pickedHex = (p) => p.device?.hex || p.figma?.hex;

// ── 자 결과 + 간격 토큰 매칭 ────────────────────
function RulerResult({ c }) {
  const r = c.rulerResult;
  if (!r || r.px == null) return null;
  return (
    <section>
      <h2>자</h2>
      <div className="stat"><span>거리</span><b>{r.px}<span className="readout-unit">px</span></b></div>
      <div className="stat"><span>dp 환산</span><b>{r.dp ?? "—"}<span className="readout-unit">dp</span></b></div>
      {r.match && (
        <div className="row" style={{ marginTop: 6, alignItems: "center" }}>
          {r.match.within ? (
            <>
              <b className="mono" style={{ flex: 1 }}>{r.match.best.name}</b>
              <span className="badge exact">일치 ({r.match.best.value}dp)</span>
            </>
          ) : (
            <>
              <span className="dim" style={{ flex: 1 }}>가장 가까움: {r.match.best?.name}</span>
              <span className="badge off">토큰 없음 (Δ{r.match.diff.toFixed(1)}dp)</span>
            </>
          )}
        </div>
      )}
    </section>
  );
}

// ── figma 노드 스펙 (Dev Mode 유사) ─────────────
function FigmaSpec({ c }) {
  const s = c.spec;
  if (!s) return <section><h2>스펙</h2><p className="dim">Figma 프레임/컴포넌트를 선택하세요.</p></section>;
  const density = c.deviceStatus?.density;
  const typoMatch = s.text ? matchTypography(
    { fontFamily: s.text.fontFamily, fontWeight: s.text.fontWeight, fontSize: s.text.fontSize, lineHeightPx: s.text.lineHeightPx },
    c.tokens
  ) : null;

  return (
    <section>
      <h2>스펙 · {s.name}</h2>
      <div className="stat"><span>W × H</span><b>{fmt(s.width)} × {fmt(s.height)}</b></div>

      {s.fills?.length > 0 && (
        <>
          <label>배경/채움</label>
          {s.fills.map((f, i) => <ColorRow key={i} hex={f} />)}
        </>
      )}

      {s.padding && (
        <div className="stat"><span>padding</span>
          <b>{s.padding.top} {s.padding.right} {s.padding.bottom} {s.padding.left}</b>
        </div>
      )}
      {s.itemSpacing != null && (
        <div className="stat"><span>itemSpacing</span><b>{s.itemSpacing}</b></div>
      )}

      {s.text && (
        <>
          <h2>타이포</h2>
          <div className="stat"><span>font</span><b>{s.text.fontFamily} {s.text.fontWeight}</b></div>
          <div className="stat"><span>size</span><b>{formatTypoUnit(s.text.fontSize, density)} {CONSTANTS.defaultUnit} ({s.text.fontSize}px)</b></div>
          <div className="stat"><span>line height</span><b>{s.text.lineHeightPx}px</b></div>
          <div className="stat"><span>letter spacing</span>
            <b>{s.text.letterSpacingPct != null ? `${s.text.letterSpacingPct}%` : `${s.text.letterSpacing}px`}</b>
          </div>
          {s.text.textColor && <ColorRow label="text color" hex={s.text.textColor} />}
          {typoMatch?.best && (
            <div className="row" style={{ marginTop: 6, alignItems: "center" }}>
              <b className="mono" style={{ flex: 1 }}>{typoMatch.best.name}</b>
              <span className={`badge ${typoMatch.exact ? "exact" : "near"}`}>
                {typoMatch.exact ? "스타일 일치" : "근사"}
              </span>
            </div>
          )}
        </>
      )}

      {s.styles && (
        <>
          <label>스타일</label>
          {Object.entries(s.styles).map(([role, st]) => (
            <div key={role} className="stat"><span>{role}</span><b>{st.name || st.id}</b></div>
          ))}
        </>
      )}
    </section>
  );
}

// ── 공통: 색 한 줄 (클릭 복사) ──────────────────
function ColorRow({ label, hex, sub }) {
  if (!hex) return null;
  return (
    <div className="row copyable" style={{ alignItems: "center", padding: "2px 0" }} onClick={() => copy(hex)} title="클릭하여 복사">
      <span className="swatch" style={{ background: aarrggbbToCss(hex) }} />
      {label && <span className="dim" style={{ flex: "none", width: 66 }}>{label}</span>}
      <b className="mono" style={{ flex: 1 }}>{hex}</b>
      {sub && <span className="dim" style={{ fontSize: 11 }}>{sub}</span>}
    </div>
  );
}

const fmt = (n) => (n == null ? "—" : Math.round(n * 10) / 10);
