// 컬러 토큰 뷰어 — tokens/ 에 올린 컬러 토큰을 스와치로 훑어보는 모달.
// 그룹 탭은 토큰 name의 최상위 세그먼트(예: "Background/Regular" → "Background")에서 동적으로 뽑는다.
import { useState, useMemo } from "react";
import { useCompare } from "../../state/CompareContext.jsx";
import { aarrggbbToCss } from "../../lib/color.js";

const copy = (t) => navigator.clipboard?.writeText(t);
const groupOf = (name) => name.split("/")[0];

export default function TokenViewer({ open, onClose }) {
  const c = useCompare();
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("all"); // all | Normal | Inverse
  const [group, setGroup] = useState("all");

  const allColorTokens = useMemo(() => c.tokens.filter((t) => t.category === "color"), [c.tokens]);

  const groups = useMemo(() => {
    const counts = new Map();
    for (const t of allColorTokens) {
      const g = groupOf(t.name);
      counts.set(g, (counts.get(g) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
  }, [allColorTokens]);

  if (!open) return null;

  const colorTokens = allColorTokens.filter(
    (t) =>
      (mode === "all" || t.mode === mode) &&
      (group === "all" || groupOf(t.name) === group) &&
      (!search || t.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0, flex: 1 }}>컬러 토큰 ({colorTokens.length})</h3>
          <button onClick={onClose}>닫기</button>
        </div>

        <div className="chip-row" style={{ marginBottom: 8 }}>
          <button className={group === "all" ? "active" : ""} onClick={() => setGroup("all")}>
            전체
          </button>
          {groups.map((g) => (
            <button key={g} className={group === g ? "active" : ""} onClick={() => setGroup(g)}>
              {g}
            </button>
          ))}
        </div>

        <div className="row" style={{ marginBottom: 8 }}>
          <input placeholder="토큰 이름 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="chip-row" style={{ flex: "none" }}>
            {["all", "Normal", "Inverse"].map((m) => (
              <button key={m} className={mode === m ? "active" : ""} onClick={() => setMode(m)}>
                {m === "all" ? "전체" : m}
              </button>
            ))}
          </div>
        </div>

        {colorTokens.length === 0 ? (
          <p className="dim">조건에 맞는 토큰이 없습니다.</p>
        ) : (
          <div className="token-grid">
            {colorTokens.map((t) => (
              <div key={t.id} className="token-card" onClick={() => copy(t.value)} title="클릭하여 hex 복사">
                <span className="token-swatch" style={{ background: aarrggbbToCss(t.value) }} />
                <div className="token-card-info">
                  <b title={t.name}>{t.name}</b>
                  <span className="dim mono" style={{ fontSize: 10 }}>{t.value}</span>
                  <span className="dim" style={{ fontSize: 10 }}>
                    {t.mode}
                    {t.primitive ? ` · ${t.primitive}` : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
