// Local-only bridge between the Figma plugin UI and `adb`.
// Mostly runs read-only adb commands (devices, screencap, wm size/density).
// The one exception is /calibrate-density (and /reset-density, which undoes
// it): they override the connected device's display density — the same
// effect as the on-device "디스플레이 크기" setting — so its logical width
// matches the plugin's fixed export width and text renders at a comparable
// size to Figma. Never installs or pushes anything, and never touches Figma
// or GitHub.

const express = require("express");
const { spawn, execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PORT = 4747;
const app = express();
app.use(express.json());

// The shell that launched `npm start` may not have Android SDK's
// platform-tools on PATH (e.g. a terminal opened before PATH was updated),
// even though adb is installed. Fall back to the well-known SDK location
// Android Studio uses so this doesn't depend on the caller's shell env.
function resolveAdbPath() {
  const candidates = [
    process.env.ANDROID_HOME && path.join(process.env.ANDROID_HOME, "platform-tools", "adb"),
    process.env.ANDROID_SDK_ROOT && path.join(process.env.ANDROID_SDK_ROOT, "platform-tools", "adb"),
    path.join(os.homedir(), "Library/Android/sdk/platform-tools/adb"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return "adb"; // last resort: rely on PATH
}

const ADB_PATH = resolveAdbPath();
console.log(`Using adb at: ${ADB_PATH}`);

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

function adbNotFoundMessage(err) {
  if (err && err.code === "ENOENT") {
    return "adb를 찾을 수 없습니다. Android platform-tools를 설치하고 PATH에 추가해주세요.";
  }
  return err instanceof Error ? err.message : String(err);
}

function execAdb(args) {
  return new Promise((resolve, reject) => {
    execFile(ADB_PATH, args, (err, stdout, stderr) => {
      if (err) {
        // Node's execFile error message is just "Command failed: ..." —
        // the actual reason (e.g. device offline, permission denied) is in
        // stderr, so fold it in or callers only ever see a useless message.
        reject(new Error(stderr && stderr.trim() ? stderr.trim() : err.message));
        return;
      }
      resolve(stdout);
    });
  });
}

// Android's baseline density bucket (mdpi) — 1dp == 1px at this density.
// Figma frames are conventionally authored at this same 1x scale, so
// dividing a device's raw pixel size by (density / 160) gives the size that
// matches a Figma frame 1:1.
const BASELINE_DPI = 160;

// Reads the device's actual density + physical screen resolution via adb so
// screenshots can be scaled by real DPI instead of guessed from image size.
async function getDeviceMetrics(deviceId) {
  try {
    const [densityOut, sizeOut] = await Promise.all([
      execAdb(["-s", deviceId, "shell", "wm", "density"]),
      execAdb(["-s", deviceId, "shell", "wm", "size"]),
    ]);

    const densityMatch =
      densityOut.match(/Override density:\s*(\d+)/) || densityOut.match(/Physical density:\s*(\d+)/);
    const sizeMatch =
      sizeOut.match(/Override size:\s*(\d+)x(\d+)/) || sizeOut.match(/Physical size:\s*(\d+)x(\d+)/);

    if (!densityMatch || !sizeMatch) return null;

    const density = parseInt(densityMatch[1], 10);
    const scale = density / BASELINE_DPI;
    const sizePx = { width: parseInt(sizeMatch[1], 10), height: parseInt(sizeMatch[2], 10) };
    const sizeDp = {
      width: Math.round(sizePx.width / scale),
      height: Math.round(sizePx.height / scale),
    };

    return { density, scale, sizePx, sizeDp };
  } catch {
    // Device may be offline/unauthorized — degrade gracefully, caller falls
    // back to the old height-matching behavior when metrics is null.
    return null;
  }
}

// Generic Play Store emulator system images report a build-fingerprint model
// like "sdk_gphone16k_arm64" via ro.product.model — never the device skin's
// friendly name (e.g. "Pixel 6"). That friendly name only exists on the
// host, as the AVD's own name, so ask the running emulator for it directly.
// No-op (returns null) for real USB devices, which don't have this concept.
async function getAvdName(deviceId) {
  if (!deviceId.startsWith("emulator-")) return null;
  try {
    const out = await execAdb(["-s", deviceId, "emu", "avd", "name"]);
    const name = out
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l && l.toUpperCase() !== "OK");
    return name || null;
  } catch {
    return null;
  }
}

// GET /devices -> [{ id, model, avdName, metrics }]
app.get("/devices", (req, res) => {
  execFile(ADB_PATH, ["devices", "-l"], async (err, stdout) => {
    if (err) {
      return res.status(500).json({ error: adbNotFoundMessage(err) });
    }
    const lines = stdout
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("List of devices"));

    const baseDevices = lines.map((line) => {
      const [id, ...rest] = line.split(/\s+/);
      const info = rest.join(" ");
      const modelMatch = info.match(/model:(\S+)/);
      return { id, model: modelMatch ? modelMatch[1] : undefined };
    });

    const devices = await Promise.all(
      baseDevices.map(async (d) => ({
        ...d,
        avdName: await getAvdName(d.id),
        metrics: await getDeviceMetrics(d.id),
      }))
    );

    res.json({ devices });
  });
});

// Runs `adb exec-out screencap -p` once and resolves with the PNG bytes.
function captureScreenshot(deviceId) {
  return new Promise((resolve, reject) => {
    const child = spawn(ADB_PATH, ["-s", deviceId, "exec-out", "screencap", "-p"]);
    const chunks = [];
    let stderr = "";

    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code !== 0 || chunks.length === 0) {
        reject(new Error(stderr.trim() || `기기(${deviceId})에서 화면을 캡처하지 못했습니다`));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
  });
}

// POST /capture { deviceId } -> image/png (single still frame)
app.post("/capture", async (req, res) => {
  const { deviceId } = req.body || {};
  if (!deviceId) {
    return res.status(400).json({ error: "deviceId가 필요합니다" });
  }
  try {
    const png = await captureScreenshot(deviceId);
    res.setHeader("Content-Type", "image/png");
    res.send(png);
  } catch (err) {
    res.status(500).json({ error: adbNotFoundMessage(err) });
  }
});

// GET /stream/:deviceId -> multipart/x-mixed-replace live preview.
// Repeatedly screencaps the device and pushes each frame as a new part, so an
// <img src="/stream/<id>"> in the plugin UI shows the emulator/device screen
// live without the user clicking "capture" over and over. Purely repeated
// reads over adb — never installs or changes anything on the device.
const STREAM_INTERVAL_MS = 700;

app.get("/stream/:deviceId", (req, res) => {
  const { deviceId } = req.params;
  const boundary = "designqaframe";

  res.writeHead(200, {
    "Content-Type": `multipart/x-mixed-replace; boundary=${boundary}`,
    "Cache-Control": "no-cache, no-store",
    Connection: "close",
    Pragma: "no-cache",
  });

  let stopped = false;
  req.on("close", () => {
    stopped = true;
  });

  (async function loop() {
    while (!stopped) {
      const start = Date.now();
      try {
        const png = await captureScreenshot(deviceId);
        if (stopped) break;
        res.write(
          `--${boundary}\r\nContent-Type: image/png\r\nContent-Length: ${png.length}\r\n\r\n`
        );
        res.write(png);
        res.write("\r\n");
      } catch (err) {
        // Device may have been unplugged mid-stream; stop quietly.
        stopped = true;
        break;
      }
      const elapsed = Date.now() - start;
      const wait = Math.max(0, STREAM_INTERVAL_MS - elapsed);
      await new Promise((r) => setTimeout(r, wait));
    }
    res.end();
  })();
});

// POST /calibrate-density { deviceId, targetWidthDp } -> { density, widthPx, widthDp }
// Reads the device's physical pixel width and overrides its density so the
// resulting logical (dp) width becomes exactly targetWidthDp — matching the
// fixed width the plugin draws screenshots at. Reversible via /reset-density.
app.post("/calibrate-density", async (req, res) => {
  const { deviceId, targetWidthDp } = req.body || {};
  if (!deviceId) {
    return res.status(400).json({ error: "deviceId가 필요합니다" });
  }
  const widthDp = Number(targetWidthDp) > 0 ? Number(targetWidthDp) : 360;

  try {
    const sizeOut = await execAdb(["-s", deviceId, "shell", "wm", "size"]);
    const sizeMatch =
      sizeOut.match(/Override size:\s*(\d+)x(\d+)/) || sizeOut.match(/Physical size:\s*(\d+)x(\d+)/);
    if (!sizeMatch) {
      return res.status(500).json({ error: `기기 해상도를 읽지 못했습니다: "${sizeOut.trim()}"` });
    }

    const widthPx = parseInt(sizeMatch[1], 10);
    const density = Math.round((widthPx / widthDp) * BASELINE_DPI);

    await execAdb(["-s", deviceId, "shell", "wm", "density", String(density)]);

    res.json({ density, widthPx, widthDp });
  } catch (err) {
    res.status(500).json({ error: adbNotFoundMessage(err) });
  }
});

// POST /reset-density { deviceId } -> { ok: true }
// Clears the density override, restoring the device's native/default density.
app.post("/reset-density", async (req, res) => {
  const { deviceId } = req.body || {};
  if (!deviceId) {
    return res.status(400).json({ error: "deviceId가 필요합니다" });
  }
  try {
    await execAdb(["-s", deviceId, "shell", "wm", "density", "reset"]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: adbNotFoundMessage(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Design QA helper server listening on http://localhost:${PORT}`);
});
