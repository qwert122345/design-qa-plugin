// 저장하려는 이름의 캡처가 이미 있을 때 — 덮어쓸지, 둘 다 남길지 고른다.
// (지금 세션을 다시 저장하는 경우는 중복이 아니라 갱신이라 여기까지 오지 않는다.)
import { useCompare } from "../../state/CompareContext.jsx";

export default function DuplicateNameDialog() {
  const c = useCompare();
  if (!c.dup) return null;

  const { name, existing, noteCount } = c.dup;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3 style={{ marginTop: 0 }}>이미 같은 이름의 캡처가 있습니다</h3>
        <p className="dim" style={{ fontSize: 12, marginBottom: 4 }}>
          저장소에 <b style={{ color: "var(--ink)" }}>&quot;{name}&quot;</b> 이(가) 있습니다.
        </p>
        <p className="dim" style={{ fontSize: 12, marginTop: 0 }}>
          {formatDate(existing.createdAt)} · 메모 {noteCount}개
        </p>

        <div className="row" style={{ marginTop: 12 }}>
          <button onClick={() => c.dupOverwrite()} disabled={c.busy}>
            덮어쓰기
          </button>
          <button className="primary" onClick={() => c.dupKeepBoth()} disabled={c.busy}>
            둘 다 보관
          </button>
          <button onClick={() => c.dupCancel()} disabled={c.busy}>
            취소
          </button>
        </div>

        <p className="dim" style={{ fontSize: 11, marginTop: 10, marginBottom: 0 }}>
          <b>덮어쓰기</b> — 기존 캡처와 메모 {noteCount}개가 사라집니다.
          <br />
          <b>둘 다 보관</b> — 새 캡처를 &quot;{name} (2)&quot; 처럼 번호를 붙여 저장합니다.
          <br />
          <b>취소</b> — 저장창으로 돌아가 이름을 직접 고칠 수 있습니다.
        </p>
      </div>
    </div>
  );
}

function formatDate(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
