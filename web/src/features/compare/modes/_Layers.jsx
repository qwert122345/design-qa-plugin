// 모드들이 공유하는 레이어 렌더 헬퍼.
// 모든 좌표는 device natural px 기준, 화면 표시는 displayScale 로 축소.
export function DeviceLayer({ view, imgRef, style }) {
  const { device, displayScale } = view;
  return (
    <img
      ref={imgRef}
      className="layer"
      src={device.url}
      alt="device"
      draggable={false}
      style={{
        width: device.w * displayScale,
        ...style,
      }}
    />
  );
}

export function FigmaLayer({ view, imgRef, style, dragHandlers }) {
  const { figma, fitScale, fineScale, offset, displayScale, figmaCursor } = view;
  const s = fitScale * fineScale * displayScale;
  return (
    <img
      ref={imgRef}
      className="layer"
      src={figma.url}
      alt="figma"
      draggable={false}
      {...dragHandlers}
      style={{
        width: figma.w * s,
        transform: `translate(${offset.x * displayScale}px, ${offset.y * displayScale}px)`,
        cursor: figmaCursor,
        touchAction: "none",
        ...style,
      }}
    />
  );
}

// device 표시 영역 크기
export function hostSize(view) {
  const { device, displayScale } = view;
  return {
    width: device.w * displayScale,
    height: device.h * displayScale,
  };
}
