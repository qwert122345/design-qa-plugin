// adb 어댑터 — 모든 adb 명령이 여기 한 곳에만. (§7)
// 라우트/서비스는 adb 를 직접 호출하지 말 것.
import { execFile } from "node:child_process";
import { config } from "../config.js";

// adb 실행기. encoding "buffer" 를 주면 stdout 을 Buffer 로 돌려준다(예: PNG).
function run(args, { encoding = "utf8" } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      "adb",
      args,
      { timeout: config.adbTimeoutMs, encoding, maxBuffer: 128 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          if (err.code === "ENOENT") {
            return reject(new Error("adb 를 찾을 수 없습니다. PATH 에 platform-tools 가 있는지 확인하세요."));
          }
          return reject(new Error(stderr?.toString().trim() || err.message));
        }
        resolve(stdout);
      }
    );
  });
}

export const adb = {
  // `adb devices` 원문
  devices: () => run(["devices"]),
  // `adb shell wm size` (예: "Physical size: 1080x2340")
  wmSize: () => run(["shell", "wm", "size"]),
  // `adb shell wm density` (예: "Physical density: 420")
  wmDensity: () => run(["shell", "wm", "density"]),
  // 기기 이름. marketname("Galaxy S25 Edge")이 있으면 그게 낫고, 없는 기기가 많아
  // model("SM-N971N")로 떨어진다. 한 번의 호출로 둘 다 받아 첫 줄부터 고른다.
  model: () => run(["shell", "getprop ro.product.marketname; getprop ro.product.model"]),
  // `adb exec-out screencap -p` → PNG Buffer (임시파일 없이 stdout)
  screencap: () => run(["exec-out", "screencap", "-p"], { encoding: "buffer" }),
  // uiautomator dump 후 xml 읽어오기
  uiautomatorDump: async () => {
    await run(["shell", "uiautomator", "dump", "/sdcard/ui.xml"]);
    return run(["shell", "cat", "/sdcard/ui.xml"]);
  },
};
