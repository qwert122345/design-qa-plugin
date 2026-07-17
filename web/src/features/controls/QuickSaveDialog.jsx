// 재캡처 없이 지금 화면을 그대로 저장소에 저장하는 확인 다이얼로그.
import { useState, useEffect } from "react";
import { useCompare } from "../../state/CompareContext.jsx";

export default function QuickSaveDialog() {
  const c = useCompare();
  const [name, setName] = useState("");

  // 기본 이름 = 화면 ID. 같은 이름이 이미 있으면 저장할 때 중복 확인창이 뜬다.
  useEffect(() => {
    if (c.pendingSave) setName(c.spec?.name || "캡처");
  }, [c.pendingSave]); // eslint-disable-line react-hooks/exhaustive-deps

  // 중복 확인창이 떠 있는 동안엔 물러난다(취소하면 입력한 이름 그대로 다시 보인다).
  if (!c.pendingSave || c.dup) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3 style={{ marginTop: 0 }}>QA 메모 저장</h3>
        <p className="dim" style={{ fontSize: 12 }}>
          현재 화면과 메모 {c.notes.length}개를 저장소에 저장합니다.
        </p>
        <label>이름</label>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" onClick={() => c.confirmSave(name)} disabled={c.busy || !name.trim()}>
            저장
          </button>
          <button onClick={() => c.cancelSave()} disabled={c.busy}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
