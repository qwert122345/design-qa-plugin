// 디바이스 서비스 — adb 어댑터 + uiautomator 파서를 조합. (express 의존 X)
import { adb } from "../adapters/adb.js";
import { scrcpy } from "../adapters/scrcpy.js";
import { parseHierarchy } from "../parsers/uiautomator.js";

// `adb devices` 출력 파싱 → [{ serial, state }]
function parseDevices(out) {
  return out
    .split("\n")
    .slice(1) // "List of devices attached" 헤더 제거
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.startsWith("*")) // 데몬 메시지 제외
    .map((l) => {
      const [serial, state] = l.split(/\s+/);
      return { serial, state };
    });
}

// "Physical size: 1080x2340" (Override 있으면 그게 우선) → { width, height }
function parseSize(out) {
  const m = out.match(/Override size:\s*(\d+)x(\d+)/) || out.match(/Physical size:\s*(\d+)x(\d+)/);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

// "Physical density: 420" (Override 우선) → 420
function parseDensity(out) {
  const m = out.match(/Override density:\s*(\d+)/) || out.match(/Physical density:\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

// getprop 두 줄 중 먼저 비어있지 않은 줄. marketname 이 없는 기기는 그 줄이 비어 나온다.
function parseModel(out) {
  return out.split("\n").map((s) => s.trim()).filter(Boolean)[0] ?? null;
}

export async function getStatus() {
  const devicesOut = await adb.devices();
  const devices = parseDevices(devicesOut);
  const connected = devices.find((d) => d.state === "device") || null;

  // 연결된 기기가 없으면 size/density/model 조회는 건너뜀
  let size = null;
  let density = null;
  let model = null;
  if (connected) {
    try {
      size = parseSize(await adb.wmSize());
      density = parseDensity(await adb.wmDensity());
      model = parseModel(await adb.model());
    } catch {
      /* 조회 실패해도 상태는 반환 */
    }
  }

  return {
    connected: !!connected,
    devices,
    serial: connected?.serial ?? null,
    model, // "Galaxy S25 Edge" 또는 "SM-N971N". 리포트의 기기 열 — 시리얼은 사람이 못 읽는다.
    size, // { width, height } (물리 픽셀)
    density, // dpi 숫자 (dp 환산 기준: density/160)
  };
}

export async function capturePng() {
  return adb.screencap(); // PNG Buffer
}

// 기기 밀도를 덮어써서 논리 폭(dp)이 targetWidthDp 가 되게 만든다.
//   density = 물리폭(px) / targetWidthDp × 160
// 이렇게 하면 캡처 화면의 텍스트 크기가 Figma 1x 기준(360dp)과 물리적으로 맞는다.
// 단순 이미지 리사이즈로는 못 맞추는 걸 기기 밀도 자체를 바꿔 해결. resetDensity 로 복구.
export async function calibrateDensity(targetWidthDp = 360) {
  const size = parseSize(await adb.wmSize());
  if (!size) throw new Error("기기 해상도를 읽지 못했습니다");
  const widthDp = Number(targetWidthDp) > 0 ? Number(targetWidthDp) : 360;
  const density = Math.round((size.width / widthDp) * 160);
  await adb.wmDensitySet(density);
  return { density, widthPx: size.width, widthDp };
}

// 밀도 덮어쓰기 해제 → 기기 기본 밀도로 복구.
export async function resetDensity() {
  await adb.wmDensityReset();
  return { ok: true };
}

export async function getHierarchy() {
  const xml = await adb.uiautomatorDump();
  const nodes = parseHierarchy(xml); // Compose 면 빈 배열일 수 있음
  return { count: nodes.length, nodes };
}

// 미러링 창 띄우기 — 캡처할 화면까지 폰을 직접 만지지 않고 마우스로 가는 용도.
//
// screen: { width, height, top } — 브라우저만 아는 값(화면 크기, 메뉴바 높이).
// 창은 화면 오른쪽 끝에 붙인다. 매번 같은 자리에 떠야 옮길 일이 없다.
export async function openMirror(screen) {
  return scrcpy.open(await mirrorRect(screen));
}

// 오른쪽 끝에 붙이려면 창 폭을 알아야 하는데, 폭은 기기 종횡비에서 나온다.
// (scrcpy 는 height 만 주면 폭을 알아서 맞추므로 우리는 x 를 계산할 때만 쓴다.)
async function mirrorRect(screen) {
  if (!screen?.width || !screen?.height) return null; // 모르면 scrcpy 기본 배치

  let size = null;
  try {
    size = parseSize(await adb.wmSize());
  } catch {
    /* 기기 조회 실패해도 창은 띄운다 — 위치만 기본값으로 */
  }
  if (!size) return null;

  // 세로 기준 높이를 먼저 정하고, 그 높이에서의 폭을 종횡비로 역산해 x 를 구한다.
  // ponytail: 기기가 가로로 돌아가 있으면 wm size 는 세로 크기를 그대로 주므로 창이
  // 오른쪽 끝에서 조금 뜬다. 폭 계산에 rotation 을 반영하려면 dumpsys 를 한 번 더 쳐야 해서 뒀다.
  const height = screen.height;
  const width = Math.round(height * (size.width / size.height));
  return { x: screen.width - width, y: screen.top ?? 0, height };
}
