import { DeviceLayer, FigmaLayer, hostSize } from "./_Layers.jsx";

// 겹치기 — figma 를 device 위에 불투명도(어니언스킨)로.
export default function OverlayMode({ view, deviceRef, figmaRef, figmaDragHandlers }) {
  const hs = hostSize(view);
  return (
    <div style={{ position: "relative", width: hs.width, height: hs.height, overflow: "hidden" }}>
      <DeviceLayer view={view} imgRef={deviceRef} />
      <FigmaLayer view={view} imgRef={figmaRef} style={{ opacity: view.overlayOpacity }} dragHandlers={figmaDragHandlers} />
    </div>
  );
}
