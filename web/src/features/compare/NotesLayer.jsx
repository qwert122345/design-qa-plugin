// QA 메모 — Figma 주석 스타일 핀 + 카드.
// 좌표는 다른 도구(스포이드/자)와 동일하게 device-natural 기준.
// 점(x,y)만 있으면 지점 메모, w/h 가 있으면 그 영역에 달린 메모.
import { useState, useRef, useLayoutEffect } from "react";
import { useCompare } from "../../state/CompareContext.jsx";
import { CONSTANTS } from "../../config/constants.js";
import { notePinAt } from "../../lib/geometry.js";

export default function NotesLayer({ view }) {
  const c = useCompare();

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {c.notes.map((n, i) => (
        <NotePin key={n.id} note={n} seq={i + 1} view={view} c={c} />
      ))}
      {c.notePending && (
        <NoteForm
          pos={c.notePending}
          view={view}
          seq={c.notes.length + 1}
          measures={c.measures}
          onSave={(text, category, measure) => c.addNote(c.notePending, text, category, measure)}
          onCancel={() => c.setNotePending(null)}
        />
      )}
    </div>
  );
}

// 카테고리 칩 — SpecPanel 목록에서도 재사용.
export function CategoryChip({ category }) {
  if (!category) return null;
  return <span className={`cat-chip cat-${category.toLowerCase()}`}>{category}</span>;
}

// 메모에 붙은 측정값 — 개발자 리포트의 기대값/실제값/차이가 그대로 이것이다.
// SpecPanel 메모 목록에서도 재사용.
export function MeasureRow({ measure }) {
  if (!measure) return null;
  return (
    <div className="measure-row">
      <span className="measure-delta">
        {measure.delta}
        <small> {measure.unit}</small>
      </span>
      <span className="measure-vs">
        <b>{measure.actual}</b> → {measure.expected.token}
      </span>
    </div>
  );
}

// 카드는 지점 기준으로 아래·가운데에 뜬다. 지점이 캔버스 가장자리면 카드가 stage 밖으로
// 나가는데, stage 는 overflow:auto 라 그대로 잘려 메모가 안 보인다. 뜬 뒤 재서 안으로 민다.
// ponytail: 뜰 때 한 번만 잰다. 수정 모드로 카드가 커지면 다시 재지 않는다 — 필요해지면 ResizeObserver.
function useKeepInStage(ref) {
  const [nudge, setNudge] = useState({ x: 0, y: 0 });
  useLayoutEffect(() => {
    const stage = ref.current?.closest(".canvas-stage");
    if (!stage) return;
    const r = ref.current.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    const pad = 8;
    // 넘친 만큼만 되민다. 양쪽 다 넘치면(카드가 stage 보다 큼) 시작 쪽을 맞춘다.
    const fix = (lo, hi, sLo, sHi) =>
      lo < sLo + pad ? sLo + pad - lo : hi > sHi - pad ? Math.min(0, sHi - pad - hi) : 0;
    setNudge({ x: fix(r.left, r.right, s.left, s.right), y: fix(r.top, r.bottom, s.top, s.bottom) });
  }, [ref]);
  // CSS 의 translateX(-50%) 를 여기서 이어받는다.
  return { transform: `translate(calc(-50% + ${nudge.x}px), ${nudge.y}px)` };
}

function CategorySelect({ value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {CONSTANTS.noteCategories.map((cat) => (
        <option key={cat} value={cat}>
          {cat}
        </option>
      ))}
    </select>
  );
}

// 영역이 있는 메모의 사각형 표시.
function RegionBox({ pos, view, pending }) {
  if (!(pos.w > 0 || pos.h > 0)) return null;
  const s = view.displayScale;
  return (
    <div
      className={"note-region" + (pending ? " pending" : "")}
      style={{ left: pos.x * s, top: pos.y * s, width: pos.w * s, height: pos.h * s }}
    />
  );
}

function NotePin({ note, seq, view, c }) {
  const s = view.displayScale;
  const open = c.activeNoteId === note.id;
  const at = notePinAt(note);
  return (
    <>
      <RegionBox pos={note} view={view} />
      <div style={{ position: "absolute", left: at.x * s, top: at.y * s, transform: "translate(-50%, -50%)" }}>
        <button
          className="note-pin"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => c.setActiveNoteId(open ? null : note.id)}
          title={note.text}
        >
          {seq}
        </button>
        {open && <NoteCard note={note} c={c} />}
      </div>
    </>
  );
}

function NoteCard({ note, c }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);
  const [category, setCategory] = useState(note.category || CONSTANTS.defaultNoteCategory);
  const ref = useRef(null);
  const style = useKeepInStage(ref);
  return (
    <div className="note-card" ref={ref} style={style} onPointerDown={(e) => e.stopPropagation()}>
      {editing ? (
        <>
          <CategorySelect value={category} onChange={setCategory} />
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus style={{ marginTop: 6 }} />
          <div className="row" style={{ marginTop: 6 }}>
            <button
              className="primary"
              onClick={() => {
                c.updateNote(note.id, text, category);
                setEditing(false);
              }}
            >
              저장
            </button>
            <button
              onClick={() => {
                setText(note.text);
                setCategory(note.category || CONSTANTS.defaultNoteCategory);
                setEditing(false);
              }}
            >
              취소
            </button>
          </div>
        </>
      ) : (
        <>
          <CategoryChip category={note.category} />
          <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{note.text}</p>
          <MeasureRow measure={note.measure} />
          <div className="row" style={{ marginTop: 6 }}>
            <button onClick={() => setEditing(true)}>수정</button>
            <button onClick={() => c.deleteNote(note.id)}>삭제</button>
          </div>
        </>
      )}
    </div>
  );
}

function NoteForm({ pos, view, seq, measures, onSave, onCancel }) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState(CONSTANTS.defaultNoteCategory);
  // 붙일 측정값. 기본은 첫 번째 — 방금 잰 값을 그대로 쓰는 게 대부분이라서.
  const [pick, setPick] = useState(measures[0]?.kind ?? null);
  const s = view.displayScale;
  const measure = measures.find((m) => m.kind === pick) ?? null;
  const at = notePinAt(pos);
  const ref = useRef(null);
  const style = useKeepInStage(ref);

  return (
    <>
      <RegionBox pos={pos} view={view} pending />
      <div
        style={{ position: "absolute", left: at.x * s, top: at.y * s, transform: "translate(-50%, -50%)" }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="note-pin pending">{seq}</div>
        <div className="note-card" ref={ref} style={style}>
          <CategorySelect value={category} onChange={setCategory} />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            autoFocus
            placeholder="메모 입력..."
            style={{ marginTop: 6 }}
          />
          <MeasureAttach measures={measures} pick={pick} onPick={setPick} />
          <div className="row" style={{ marginTop: 6 }}>
            <button className="primary" onClick={() => text.trim() && onSave(text, category, measure)}>
              저장
            </button>
            <button onClick={onCancel}>취소</button>
          </div>
        </div>
      </div>
    </>
  );
}

// 측정값 첨부 — 무엇이 붙는지 보여주고 고르게 한다. 개발자 리포트의 기대값/실제값/차이가
// 여기서 나오므로, 딴 데서 잰 값이 조용히 붙으면 안 된다.
function MeasureAttach({ measures, pick, onPick }) {
  if (measures.length === 0) return null;
  return (
    <div className="measure-attach">
      <label>측정값 첨부</label>
      {measures.map((m) => (
        <button
          key={m.kind}
          className={pick === m.kind ? "active" : ""}
          onClick={() => onPick(pick === m.kind ? null : m.kind)}
          title={`실제 ${m.actual} · 기대 ${m.expected.token} ${m.expected.value} · 차이 ${m.delta}${m.unit}`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
