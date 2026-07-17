// scrcpy 어댑터 — 미러링 창 띄우기. (§7 adb.js 와 같은 규칙: 외부 바이너리는 여기서만)
// adb 와 달리 오래 사는 프로세스라 detached 로 띄우고 끝난 뒤를 기다리지 않는다.
import { execFile, spawn } from "node:child_process";

// 창 제목 — 어느 창이 이 툴에서 뜬 건지 사람이 알아보라고 붙인다.
const TITLE_ARG = "--window-title=design-qa";

// 이미 떠 있는 창이 있나. 서버 메모리에 핸들을 들고 있으면 서버가 재시작될 때
// (dev 의 --watch, 툴 재실행) 떠 있는 창을 잊어버려 창이 두 개가 된다 → 매번 실제로 찾는다.
//
// -x(이름만 정확히 일치)로 찾는다. -f(전체 명령줄)로 찾으면 "scrcpy" 를 언급하는 다른
// 명령줄까지 잡혀서, 창이 없는데도 있다고 나온다. 대신 사용자가 터미널에서 직접 띄운
// scrcpy 도 잡히는데, 그건 이미 미러링 중이니 하나 더 안 띄우는 게 맞다.
function isRunning() {
  return new Promise((resolve) => {
    // pgrep 은 못 찾으면 exit 1 이다 — 에러가 아니라 "없음".
    execFile("pgrep", ["-x", "scrcpy"], (err, stdout) => {
      resolve(!err && stdout.trim() !== "");
    });
  });
}

// 위치 인자. 브라우저가 준 값이라 정수인 것만 넘긴다 — 이상한 값이 들어가면
// scrcpy 가 알아보기 힘든 에러로 죽는다. 하나라도 없으면 그냥 scrcpy 기본 배치.
function windowArgs(rect) {
  if (!rect) return [];
  const { x, y, height } = rect;
  if (![x, y, height].every(Number.isInteger)) return [];
  return [`--window-x=${x}`, `--window-y=${y}`, `--window-height=${height}`];
}

export const scrcpy = {
  // 미러링 창을 띄운다. 이미 떠 있으면 아무것도 하지 않는다(창 하나면 충분).
  // 사용자가 창을 닫으면 다음 호출에서 다시 뜬다.
  //
  // rect: { x, y, height } — 창을 띄울 위치(없으면 scrcpy 기본값 "auto").
  async open(rect) {
    if (await isRunning()) return { started: false };

    const p = spawn("scrcpy", [TITLE_ARG, "--always-on-top", ...windowArgs(rect)], {
      detached: true,
      stdio: "ignore",
    });

    // spawn 실패(미설치 등)는 throw 가 아니라 "error" 이벤트로 온다 →
    // 둘 중 먼저 오는 이벤트로 결론낸다. 안 그러면 버튼이 조용히 아무 일도 안 한 게 된다.
    return new Promise((resolve, reject) => {
      p.once("spawn", () => {
        p.unref(); // 서버가 먼저 꺼져도 창은 살아있게
        resolve({ started: true });
      });
      p.once("error", (e) => {
        const err =
          e.code === "ENOENT"
            ? new Error("scrcpy 를 찾을 수 없습니다. `brew install scrcpy` 로 설치하세요.")
            : e;
        err.status = 500;
        reject(err);
      });
    });
  },
};
