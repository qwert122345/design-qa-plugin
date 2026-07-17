// 색 유틸 — hex/rgb 변환, 색차(ΔE).

// #AARRGGBB 또는 #RRGGBB → { a, r, g, b } (0~255)
export function parseAARRGGBB(hex) {
  if (typeof hex !== "string") return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 6) h = "FF" + h;
  if (h.length !== 8) return null;
  return {
    a: parseInt(h.slice(0, 2), 16),
    r: parseInt(h.slice(2, 4), 16),
    g: parseInt(h.slice(4, 6), 16),
    b: parseInt(h.slice(6, 8), 16),
  };
}

// {r,g,b} → #RRGGBB
export function rgbToHex({ r, g, b }) {
  const h = (n) => Math.round(n).toString(16).padStart(2, "0").toUpperCase();
  return `#${h(r)}${h(g)}${h(b)}`;
}

// {r,g,b,a?} → #AARRGGBB
export function rgbaToAARRGGBB({ r, g, b, a = 255 }) {
  const h = (n) => Math.round(n).toString(16).padStart(2, "0").toUpperCase();
  return `#${h(a)}${h(r)}${h(g)}${h(b)}`;
}

// sRGB → CIE Lab
function srgbToLab({ r, g, b }) {
  let [rl, gl, bl] = [r, g, b].map((v) => {
    v /= 255;
    return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
  });
  // linear RGB → XYZ (D65)
  let x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
  let y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  let z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  [x, y, z] = [f(x), f(y), f(z)];
  return { L: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

// 두 색(#hex) 간 ΔE (CIE76). 입력은 #AARRGGBB/#RRGGBB 모두 허용(알파 무시).
export function deltaE(hex1, hex2) {
  const c1 = parseAARRGGBB(hex1);
  const c2 = parseAARRGGBB(hex2);
  if (!c1 || !c2) return Infinity;
  const l1 = srgbToLab(c1);
  const l2 = srgbToLab(c2);
  return Math.sqrt((l1.L - l2.L) ** 2 + (l1.a - l2.a) ** 2 + (l1.b - l2.b) ** 2);
}

// #AARRGGBB/#RRGGBB → css rgba() (스와치 표시용)
export function aarrggbbToCss(hex) {
  const c = parseAARRGGBB(hex);
  if (!c) return "transparent";
  return `rgba(${c.r},${c.g},${c.b},${c.a / 255})`;
}

