import { DeviceLayer, FigmaLayer, hostSize } from "./_Layers.jsx";

// 나란히 — 두 이미지를 좌우로 배치.
export default function SideBySideMode({ view, deviceRef, figmaRef, figmaDragHandlers }) {
  const hs = hostSize(view);
  const figmaW = view.figma.w * view.fitScale * view.fineScale * view.displayScale;
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ position: "relative", width: hs.width, height: hs.height, overflow: "hidden", flex: "none" }}>
        <DeviceLayer view={view} imgRef={deviceRef} />
      </div>
      <div style={{ position: "relative", width: figmaW, height: hs.height, overflow: "hidden", flex: "none" }}>
        <FigmaLayer view={view} imgRef={figmaRef} style={{ position: "static" }} dragHandlers={figmaDragHandlers} />
      </div>
    </div>
  );
}
