// 재캡처 시 "QA 메모를 저장할까요?" 확인 다이얼로그.
import { useState, useEffect } from "react";
import { useCompare } from "../../state/CompareContext.jsx";

export default function CaptureSaveDialog() {
  const c = useCompare();
  const [name, setName] = useState("");

  // 기본 이름 = 화면 ID. 같은 이름이 이미 있으면 저장할 때 중복 확인창이 뜬다.
  useEffect(() => {
    if (c.pendingCapture) setName(c.spec?.name || "캡처");
  }, [c.pendingCapture]); // eslint-disable-line react-hooks/exhaustive-deps

  // 중복 확인창이 떠 있는 동안엔 물러난다(취소하면 입력한 이름 그대로 다시 보인다).
  if (!c.pendingCapture || c.dup) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3 style={{ marginTop: 0 }}>QA 메모를 저장할까요?</h3>
        <p className="dim" style={{ fontSize: 12 }}>
          현재 캡처에 메모 {c.notes.length}개가 있습니다. 저장하면 이름 붙여 저장소에 보관되고,
          저장 안 하면 이 메모는 사라집니다.
        </p>
        <label>이름</label>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" onClick={() => c.saveAndRecapture(name)} disabled={c.busy || !name.trim()}>
            저장하기
          </button>
          <button onClick={() => c.discardAndRecapture()} disabled={c.busy}>
            저장 안 함
          </button>
          <button onClick={() => c.cancelRecapture()} disabled={c.busy}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
