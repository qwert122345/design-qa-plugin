// 좌측 컨트롤 — 디바이스 / figma / 비교대상 / 모드.
import { useState } from "react";
import { useCompare } from "../../state/CompareContext.jsx";
import CaptureSaveDialog from "./CaptureSaveDialog.jsx";
import DuplicateNameDialog from "./DuplicateNameDialog.jsx";
import TokenViewer from "./TokenViewer.jsx";

export default function ControlsPanel() {
  const c = useCompare();
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
      {/* 밀도 캘리브레이션 — 기기 밀도를 360dp 기준으로 덮어써 캡처 텍스트 크기를 Figma 와 맞춤 */}
      <div className="row" style={{ marginTop: 6 }}>
        <button
          onClick={c.calibrateDensity}
          disabled={c.busy}
          title="기기 밀도를 360dp 기준으로 맞춰, 캡처되는 화면의 텍스트 크기가 Figma(1x)와 일치하게 합니다"
        >
          밀도 360dp 맞추기
        </button>
        <button onClick={c.resetDensity} disabled={c.busy} title="기기 밀도를 원래대로 되돌립니다">
          밀도 초기화
        </button>
      </div>
      {c.densityInfo && (
        <p className="dim" style={{ fontSize: 11, marginTop: 4 }}>{c.densityInfo}</p>
      )}
      <CaptureSaveDialog />
      {/* 이름 중복 확인 — "화면 캡처"/"메모 저장" 양쪽 저장 흐름이 공유하므로 여기 한 번만 건다. */}
      <DuplicateNameDialog />

      {/* figma — 플러그인은 Figma 캔버스에서 지금 선택한 프레임을 자동으로 받는다 */}
      <h2>Figma</h2>
      {c.selectedFrame ? (
        <div className="stat">
          <span>선택</span>
          <b title={c.selectedFrame.name} style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {c.selectedFrame.name}
          </b>
        </div>
      ) : (
        <p className="dim" style={{ fontSize: 11 }}>Figma 캔버스에서 프레임 1개를 선택하세요.</p>
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
