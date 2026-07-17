// 저장소 — 이름 붙여 저장한 캡처 목록. 클릭하면 캔버스로 다시 불러오고, 선택해서
// Figma "Design QA" 페이지에 이미지(캡처+QA 메모)로 추가할 수 있다.
import { useEffect, useState } from "react";
import { useCompare } from "../../state/CompareContext.jsx";
import { capturesApi, notesApi } from "../../api.js";
import { renderCaptureToBlob } from "../../lib/exportCapture.js";
import { addImagesToFigma } from "../../figmaBridge.js";

export default function CaptureStorage({ open, onClose }) {
  const c = useCompare();
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(null); // null | "figma" | "delete"
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (open) c.loadCaptures();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectedCaps = () => c.captures.filter((cap) => selected.has(cap.id));

  // 휴지통으로 보낸다 — 메모는 캡처에 붙은 채로 같이 따라간다.
  const deleteCaptures = async (caps) => {
    if (caps.length === 0 || busy) return;
    setBusy("delete");
    try {
      for (const cap of caps) await c.removeCapture(cap.id); // 개별 실패는 removeCapture 가 알린다
      setSelected(new Set());
    } finally {
      setBusy(null);
    }
  };

  // 선택 캡처를 캡처+QA 메모 이미지로 합성해 Figma "Design QA" 페이지에 노드로 추가.
  // (플러그인은 OS 클립보드 이미지 복사가 불가 — data: URL 비보안 컨텍스트라
  //  navigator.clipboard 가 없다. 그래서 Figma 안에 이미지로 넣는다.)
  const addToFigma = async (caps) => {
    if (caps.length === 0 || busy) return;
    setBusy("figma");
    setStatus(null);
    c.setError(null);
    try {
      const images = [];
      for (const cap of caps) {
        const notes = await notesApi.list(cap.id);
        // 원래 목록에서의 번호를 붙여둔다 — 나눠 그려도 핀 번호가 앱의 메모 목록과 맞는다.
        const numbered = notes.map((note, i) => ({ ...note, seq: i + 1 }));
        // 메모가 2개 이상이면 한 장에 하나씩(이미지를 메모 수만큼 복제). 0~1개면 한 장.
        const perImage = numbered.length > 1 ? numbered.map((note) => [note]) : [numbered];

        for (const [i, group] of perImage.entries()) {
          const blob = await renderCaptureToBlob(capturesApi.imageUrl(cap.id), group);
          const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
          images.push({ bytes, name: sanitize(cap.name) + (perImage.length > 1 ? `-${i + 1}` : "") });
        }
      }
      const res = await addImagesToFigma(images);
      if (res && res.ok) setStatus(`Figma "Design QA" 페이지에 ${res.count}개 추가했습니다`);
      else c.setError("Figma 추가 실패: " + (res?.error || "알 수 없는 오류"));
    } catch (e) {
      c.setError("Figma 추가 실패: " + e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0, flex: 1 }}>저장된 캡처</h3>
          <button onClick={onClose}>닫기</button>
        </div>
        {c.captures.length === 0 ? (
          <p className="dim">저장된 캡처가 없습니다. 화면 캡처 후 메모를 남기고 다시 캡처하면 저장할 수 있어요.</p>
        ) : (
          <>
            <div className="row" style={{ marginBottom: 8 }}>
              <button onClick={() => addToFigma(c.captures)} disabled={!!busy}>
                전체 Figma에 추가 ({c.captures.length})
              </button>
              <button onClick={() => addToFigma(selectedCaps())} disabled={!!busy || selected.size === 0}>
                선택 Figma에 추가 ({selected.size})
              </button>
              {busy === "figma" && <span className="dim" style={{ fontSize: 11 }}>이미지 합성 중...</span>}
              {busy === "delete" && <span className="dim" style={{ fontSize: 11 }}>삭제 중...</span>}
              {!busy && status && <span className="dim" style={{ fontSize: 11 }}>{status}</span>}
            </div>
            {/* 삭제는 휴지통으로 가니 확인을 묻지 않는다 — 되돌릴 데가 있다. */}
            <div className="row" style={{ marginBottom: 8 }}>
              <button onClick={() => deleteCaptures(selectedCaps())} disabled={!!busy || selected.size === 0}>
                선택 삭제 ({selected.size})
              </button>
              <button onClick={() => deleteCaptures(c.captures)} disabled={!!busy}>
                전체 삭제 ({c.captures.length})
              </button>
            </div>
            <CaptureGrid
              caps={c.captures}
              selected={selected}
              toggle={toggle}
              onImageClick={(cap) => {
                c.openCapture(cap);
                onClose();
              }}
              onRemove={(cap) => c.removeCapture(cap.id)}
              removeTitle="휴지통으로"
            />
          </>
        )}
      </div>
    </div>
  );
}

// 캡처 카드 격자 — 저장소와 휴지통이 같이 쓴다.
// 카드에 붙는 동작만 다르다: 저장소는 열기/휴지통으로, 휴지통은 복원/완전 삭제.
export function CaptureGrid({ caps, selected, toggle, onImageClick, onRemove, removeTitle }) {
  return (
    <div className="capture-grid">
      {caps.map((cap) => (
        <div key={cap.id} className="capture-card">
          <input
            type="checkbox"
            className="capture-card-check"
            checked={selected.has(cap.id)}
            onChange={() => toggle(cap.id)}
            onClick={(e) => e.stopPropagation()}
          />
          <img src={capturesApi.imageUrl(cap.id)} alt={cap.name} onClick={() => onImageClick(cap)} />
          <div className="capture-card-info">
            <b title={cap.name}>{cap.name}</b>
            <span className="dim" style={{ fontSize: 11 }}>
              {cap.nodeName ? `${cap.nodeName} · ` : ""}
              {formatDate(cap.deletedAt || cap.createdAt)}
            </span>
          </div>
          <button className="capture-card-del" onClick={() => onRemove(cap)} title={removeTitle}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export function formatDate(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sanitize(name) {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "capture";
}
