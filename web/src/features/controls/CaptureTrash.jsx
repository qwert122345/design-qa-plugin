// 휴지통 — 저장소에서 지운 캡처. 복원하면 메모까지 그대로 돌아온다.
// 여기서 "완전 삭제" 해야만 PNG 가 실제로 사라진다.
import { useEffect, useState } from "react";
import { useCompare } from "../../state/CompareContext.jsx";
import { CaptureGrid } from "./CaptureStorage.jsx";

export default function CaptureTrash({ open, onClose }) {
  const c = useCompare();
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(null); // 완전 삭제를 기다리는 캡처 배열

  useEffect(() => {
    if (open) c.loadTrash();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectedCaps = () => c.trash.filter((cap) => selected.has(cap.id));

  const run = async (caps, action) => {
    if (caps.length === 0 || busy) return;
    setConfirmPurge(null);
    setBusy(true);
    try {
      for (const cap of caps) await action(cap.id); // 개별 실패는 context 가 알린다
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0, flex: 1 }}>휴지통</h3>
          <button onClick={onClose}>닫기</button>
        </div>
        {c.trash.length === 0 ? (
          <p className="dim">휴지통이 비어 있습니다. 저장소에서 지운 캡처가 여기로 옵니다.</p>
        ) : (
          <>
            <div className="row" style={{ marginBottom: 8 }}>
              <button onClick={() => run(selectedCaps(), c.restoreCapture)} disabled={busy || selected.size === 0}>
                선택 복원 ({selected.size})
              </button>
              <button onClick={() => run(c.trash, c.restoreCapture)} disabled={busy}>
                전체 복원 ({c.trash.length})
              </button>
            </div>
            {confirmPurge ? (
              <div className="row" style={{ marginBottom: 8 }}>
                <span className="dim" style={{ fontSize: 11, flex: 2 }}>
                  캡처 {confirmPurge.length}개와 그 이미지를 영영 지웁니다. 되돌릴 수 없습니다.
                </span>
                <button className="primary" onClick={() => run(confirmPurge, c.purgeCapture)} disabled={busy}>
                  완전 삭제
                </button>
                <button onClick={() => setConfirmPurge(null)}>취소</button>
              </div>
            ) : (
              <div className="row" style={{ marginBottom: 8 }}>
                <button onClick={() => setConfirmPurge(selectedCaps())} disabled={busy || selected.size === 0}>
                  선택 완전 삭제 ({selected.size})
                </button>
                <button onClick={() => setConfirmPurge(c.trash)} disabled={busy}>
                  휴지통 비우기 ({c.trash.length})
                </button>
              </div>
            )}
            <CaptureGrid
              caps={c.trash}
              selected={selected}
              toggle={toggle}
              onImageClick={(cap) => c.restoreCapture(cap.id)} // 지운 걸 캔버스로 열면 헷갈린다 — 클릭은 복원
              onRemove={(cap) => setConfirmPurge([cap])}
              removeTitle="완전 삭제"
            />
          </>
        )}
      </div>
    </div>
  );
}
