// 좌측 컨트롤 — 디바이스 / figma / 비교대상 / 모드.
import { useState, useEffect } from "react";
import { useCompare } from "../../state/CompareContext.jsx";
import CaptureSaveDialog from "./CaptureSaveDialog.jsx";
import DuplicateNameDialog from "./DuplicateNameDialog.jsx";
import TokenViewer from "./TokenViewer.jsx";

export default function ControlsPanel() {
  const c = useCompare();
  const [search, setSearch] = useState("");
  const [tokenViewerOpen, setTokenViewerOpen] = useState(false);

  return (
    <div>
      {/* 디바이스 */}
      <h2>디바이스</h2>
      <div className="row">
        <button className="primary" onClick={c.requestCapture} disabled={c.busy}>
          화면 캡처
        </button>
        {/* 미러링 창에서 원하는 화면까지 간 뒤 "화면 캡처" 를 누르는 흐름. */}
        <button onClick={c.openMirror} disabled={c.busy}>
          기기 조작
        </button>
      </div>
      <DeviceStatus status={c.deviceStatus} />
      <CaptureSaveDialog />
      {/* 이름 중복 확인 — "화면 캡처"/"메모 저장" 양쪽 저장 흐름이 공유하므로 여기 한 번만 건다. */}
      <DuplicateNameDialog />

      {/* figma */}
      <h2>Figma</h2>
      <label>fileKey</label>
      <input
        value={c.fileKey}
        placeholder=".env DEFAULT_FILE_KEY 사용"
        onChange={(e) => c.setFileKey(e.target.value)}
      />
      <div className="row" style={{ marginTop: 6 }}>
        <input
          placeholder="프레임 이름 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && c.loadFrames(search)}
        />
        <button style={{ flex: "none" }} onClick={() => c.loadFrames(search)} disabled={c.busy}>
          로드
        </button>
      </div>
      {c.frames.length > 0 && (
        <>
          <label>화면(프레임)</label>
          <select
            value={c.selectedFrame?.id || ""}
            onChange={(e) => c.loadFrameImage(c.frames.find((f) => f.id === e.target.value))}
          >
            <option value="">— 선택 —</option>
            {c.frames.map((f) => (
              <option key={f.id} value={f.id}>
                {f.page} / {f.name}
              </option>
            ))}
          </select>
        </>
      )}
      {/* 비교 대상 */}
      <h2>비교 대상</h2>
      <div className="chip-row">
        <button className={c.target === "screen" ? "active" : ""} onClick={() => c.setTarget("screen")}>
          화면 전체
        </button>
        <button className={c.target === "component" ? "active" : ""} onClick={() => c.setTarget("component")}>
          컴포넌트
        </button>
      </div>
      {c.target === "component" && c.figmaChildren.length > 0 && (
        <>
          <label>인스턴스</label>
          <select
            value={c.selectedChild?.id || ""}
            onChange={(e) => c.selectChild(c.figmaChildren.find((ch) => ch.id === e.target.value))}
          >
            <option value="">— 선택 —</option>
            {c.figmaChildren.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name}
              </option>
            ))}
          </select>
        </>
      )}

      {/* 모드 */}
      <h2>토큰 대조 모드</h2>
      <div className="chip-row">
        <button className={c.colorMode === "Normal" ? "active" : ""} onClick={() => c.setColorMode("Normal")}>
          Normal
        </button>
        <button className={c.colorMode === "Inverse" ? "active" : ""} onClick={() => c.setColorMode("Inverse")}>
          Inverse
        </button>
      </div>
      {c.tokensMeta && (
        <p className="dim" style={{ marginTop: 8, fontSize: 11 }}>
          토큰 {c.tokensMeta.total}개 로드됨 (color {c.tokensMeta.byCategory.color})
        </p>
      )}
      <button style={{ marginTop: 8 }} onClick={() => setTokenViewerOpen(true)}>
        컬러 토큰 보기
      </button>
      <TokenViewer open={tokenViewerOpen} onClose={() => setTokenViewerOpen(false)} />
    </div>
  );
}

function DeviceStatus({ status }) {
  if (!status) return <p className="dim" style={{ fontSize: 11, marginTop: 8 }}>미연결 — 캡처를 눌러 확인</p>;
  return (
    <div style={{ marginTop: 8 }}>
      <div className="stat">
        <span>연결</span>
        <b style={{ color: status.connected ? "var(--ok)" : "var(--off)" }}>
          {status.connected ? status.serial : "없음"}
        </b>
      </div>
      {status.size && (
        <div className="stat">
          <span>해상도</span>
          <b>{status.size.width}×{status.size.height}</b>
        </div>
      )}
      {status.density && (
        <div className="stat">
          <span>density</span>
          <b>{status.density} dpi</b>
        </div>
      )}
    </div>
  );
}
