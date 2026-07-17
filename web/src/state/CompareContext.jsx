// 전역 비교 상태 + 액션. 백엔드 호출은 api/ 를 통해서만.
import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { deviceApi, tokensApi, notesApi, capturesApi } from "../api.js";
import { onFigmaSelection, exportFigmaNode } from "../figmaBridge.js";
import { CONSTANTS } from "../config/constants.js";

const Ctx = createContext(null);
export const useCompare = () => useContext(Ctx);

// 헬퍼 서버가 안 떠 있으면 fetch 자체가 실패한다(TypeError: Failed to fetch /
// ERR_CONNECTION_REFUSED). 그 경우 원인을 콕 집어 안내한다 — 이게 플러그인에서
// 가장 흔한 첫 실패다.
const HELPER_DOWN =
  "헬퍼 서버(localhost:3011)에 연결할 수 없습니다. 터미널에서 `npm run server` 를 실행한 뒤 플러그인을 다시 열어주세요.";
const asError = (e, fallback) =>
  /failed to fetch|load failed|networkerror|err_connection|fetch/i.test(e?.message || "")
    ? HELPER_DOWN
    : `${fallback}: ${e.message}`;

// crypto.randomUUID 는 보안 컨텍스트에서만 있다. Figma 플러그인 UI 는 data: URL
// (비보안)이라 없어서 TypeError 가 난다 → getRandomValues(비보안에서도 동작)로
// v4 UUID 를 직접 만든다. (캡처 세션 구분용이라 암호학적 강도는 불필요.)
function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  const b = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function CompareProvider({ children }) {
  // ── 디바이스 ──────────────────────────────
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [deviceImg, setDeviceImg] = useState(null); // objectURL
  const [hierarchy, setHierarchy] = useState([]);
  const [densityInfo, setDensityInfo] = useState(null); // 밀도 캘리브레이션 상태 메시지

  // ── figma (플러그인: 현재 Figma 선택을 code.ts 가 push) ─────
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [figmaChildren, setFigmaChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [figmaImg, setFigmaImg] = useState(null); // objectURL
  const [spec, setSpec] = useState(null);

  // ── 비교/캔버스 ───────────────────────────
  const [viewMode, setViewMode] = useState("side"); // side | overlay
  const [overlayOpacity, setOverlayOpacity] = useState(CONSTANTS.defaultOverlayOpacity);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [fineScale, setFineScale] = useState(1);
  const [tool, setTool] = useState(null); // eyedropper | ruler | region | null
  const [region, setRegion] = useState(null); // {x,y,w,h} device px
  const [target, setTarget] = useState("screen"); // screen | component
  const [showBlueprint, setShowBlueprint] = useState(false); // 기기 레이아웃 경계 보기
  const [colorMode, setColorMode] = useState(CONSTANTS.defaultMode); // Normal | Inverse

  // ── 토큰 ─────────────────────────────────
  const [tokens, setTokens] = useState([]);
  const [tokensMeta, setTokensMeta] = useState(null);

  // ── 도구 결과 (스포이드/자) ────────────────
  const [pickResult, setPickResult] = useState(null);
  const [rulerResult, setRulerResult] = useState(null);

  // ── QA 메모(어노테이션) — 현재 캡처 세션별로 저장 ──
  const [notes, setNotes] = useState([]);
  const [notePending, setNotePending] = useState(null); // 저장 전 임시 위치 { x, y }
  const [activeNoteId, setActiveNoteId] = useState(null);

  // 열려 있는 메모 카드 바깥을 클릭하면 닫는다.
  // (핀/카드 자체는 onPointerDown에서 stopPropagation 하므로 여기까지 안 옴)
  useEffect(() => {
    if (!activeNoteId) return;
    const close = () => setActiveNoteId(null);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [activeNoteId]);

  // ── QA 캡처 저장소 ─────────────────────────
  const [captureSessionId, setCaptureSessionId] = useState(null); // 현재 기기 캡처 세션 id
  const [captureSaved, setCaptureSaved] = useState(false); // 이 세션이 저장소에 저장됐는지
  const [pendingCapture, setPendingCapture] = useState(false); // 재캡처 확인창 표시 여부
  const [pendingSave, setPendingSave] = useState(false); // "저장" 버튼 확인창 표시 여부
  const [dup, setDup] = useState(null); // 이름 중복 확인창 { name, existing, recapture, noteCount }
  const [captures, setCaptures] = useState([]); // 저장소 목록
  const [trash, setTrash] = useState([]); // 휴지통 목록

  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // 토큰 최초 로드 (헬퍼 서버가 꺼져 있으면 여기서 먼저 걸린다 → 명확히 안내)
  useEffect(() => {
    tokensApi
      .all()
      .then(({ tokens, meta }) => {
        setTokens(tokens);
        setTokensMeta(meta);
      })
      .catch((e) => setError(asError(e, "토큰 로드 실패")));
  }, []);

  // ── 액션: 디바이스 ─────────────────────────
  const captureDevice = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [url, status] = await Promise.all([deviceApi.capture(), deviceApi.status()]);
      setDeviceImg((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setDeviceStatus(status);
      // hierarchy 는 실패해도 무시(Compose 빈 배열 정상)
      deviceApi
        .hierarchy()
        .then((h) => setHierarchy(h.nodes || []))
        .catch(() => setHierarchy([]));
    } catch (e) {
      setError(asError(e, "캡처 실패"));
    } finally {
      setBusy(false);
    }
  }, []);

  // 미러링 창 띄우기 — 창은 서버(내 Mac)가 띄운다. 브라우저는 요청만.
  // 화면 크기는 브라우저만 아는 값이라 같이 보낸다(avail* = 메뉴바/독 뺀 실제 여유 공간).
  const openMirror = useCallback(async () => {
    try {
      await deviceApi.mirror({
        width: window.screen.availWidth,
        height: window.screen.availHeight,
        top: window.screen.availTop ?? 0,
      });
    } catch (e) {
      setError("미러링 실패: " + e.message);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      setDeviceStatus(await deviceApi.status());
    } catch (e) {
      setError(asError(e, "상태 조회 실패"));
    }
  }, []);

  // 기기 밀도를 360dp 기준으로 덮어써 캡처 텍스트 크기를 Figma 1x 와 맞춘다.
  // (기기 자체 밀도가 바뀌므로 이후 캡처부터 반영. resetDensity 로 복구.)
  const calibrateDensity = useCallback(async () => {
    setBusy(true);
    try {
      const r = await deviceApi.calibrateDensity(360);
      await refreshStatus();
      setDensityInfo(`밀도 ${r.density} 적용 (${r.widthPx}px → ${r.widthDp}dp). 다시 캡처하면 반영됩니다.`);
    } catch (e) {
      setError(asError(e, "밀도 맞추기 실패"));
    } finally {
      setBusy(false);
    }
  }, [refreshStatus]);

  const resetDensity = useCallback(async () => {
    setBusy(true);
    try {
      await deviceApi.resetDensity();
      await refreshStatus();
      setDensityInfo("밀도 초기화됨. 다시 캡처하면 반영됩니다.");
    } catch (e) {
      setError(asError(e, "밀도 초기화 실패"));
    } finally {
      setBusy(false);
    }
  }, [refreshStatus]);

  // 새 캡처 세션 시작(id 발급 + 실제 캡처)
  const startNewCaptureSession = useCallback(async () => {
    setCaptureSessionId(uuid());
    setCaptureSaved(false);
    setPendingCapture(false);
    await captureDevice();
  }, [captureDevice]);

  // "화면 캡처" 버튼 — 현재 세션에 저장 안 된 메모가 있으면 먼저 확인창을 띄운다.
  const requestCapture = useCallback(() => {
    if (captureSessionId && notes.length > 0 && !captureSaved) {
      setPendingCapture(true);
      return;
    }
    startNewCaptureSession();
  }, [captureSessionId, notes.length, captureSaved, startNewCaptureSession]);

  const cancelRecapture = useCallback(() => setPendingCapture(false), []);

  // 저장 안 함 — 이 세션의 메모를 버리고 새 캡처 시작
  const discardAndRecapture = useCallback(async () => {
    if (captureSessionId) notesApi.removeAll(captureSessionId).catch(() => {});
    await startNewCaptureSession();
  }, [captureSessionId, startNewCaptureSession]);

  // 현재 스크린샷+메모를 이름 붙여 저장소에 저장(세션은 그대로 유지).
  const persistCurrentCapture = useCallback(
    async (name) => {
      if (!deviceImg || !captureSessionId) return;
      const blob = await fetch(deviceImg).then((r) => r.blob());
      await capturesApi.save(
        captureSessionId,
        {
          name,
          nodeId: spec?.id,
          nodeName: spec?.name,
          device: deviceStatus?.connected
            ? {
                serial: deviceStatus.serial,
                model: deviceStatus.model,
                width: deviceStatus.size?.width,
                height: deviceStatus.size?.height,
                density: deviceStatus.density,
              }
            : null,
        },
        blob
      );
      setCaptureSaved(true);
    },
    [deviceImg, captureSessionId, spec, deviceStatus]
  );

  // 실제 저장 실행. recapture=true 면 저장 후 새 캡처 세션 시작.
  const runSave = useCallback(
    async (name, recapture) => {
      setBusy(true);
      try {
        await persistCurrentCapture(name);
        setPendingSave(false);
        setDup(null);
        if (recapture) await startNewCaptureSession();
      } catch (e) {
        setError("캡처 저장 실패: " + e.message);
      } finally {
        setBusy(false);
      }
    },
    [persistCurrentCapture, startNewCaptureSession]
  );

  // 저장 요청 — 이름이 겹치면 먼저 물어본다.
  // 지금 세션 자신은 중복이 아니다(저장된 캡처를 열어 다시 저장 = 갱신).
  const requestPersist = useCallback(
    async (name, recapture) => {
      let existing = null;
      try {
        const list = await capturesApi.list();
        existing = list.find((c) => c.name === name && c.id !== captureSessionId) || null;
      } catch {
        /* 목록 조회 실패 시엔 중복 검사를 건너뛰고 그대로 저장 */
      }
      if (!existing) return runSave(name, recapture);
      // 덮어쓰면 사라지는 메모 개수를 모달에서 알려주기 위해 미리 센다.
      const lost = await notesApi.list(existing.id).catch(() => []);
      setDup({ name, existing, recapture, noteCount: lost.length });
    },
    [captureSessionId, runSave]
  );

  // 저장하기 — 현재 스크린샷+메모를 이름 붙여 저장소에 저장한 뒤 새 캡처 시작
  const saveAndRecapture = useCallback((name) => requestPersist(name, true), [requestPersist]);

  // "저장" 버튼 — 재캡처 없이 지금 화면을 그대로 저장소에 저장
  const requestSave = useCallback(() => {
    if (!captureSessionId) return;
    setPendingSave(true);
  }, [captureSessionId]);

  const cancelSave = useCallback(() => setPendingSave(false), []);

  const confirmSave = useCallback((name) => requestPersist(name, false), [requestPersist]);

  // ── 이름 중복 모달 ────────────────────────────────
  const dupOverwrite = useCallback(async () => {
    if (!dup) return;
    setBusy(true);
    try {
      // 덮어쓰기는 완전 삭제 — 메모까지 지우고 나면 휴지통에 남겨도 복원이 반쪽이라 오해만 산다.
      await capturesApi.purge(dup.existing.id);
      await notesApi.removeAll(dup.existing.id).catch(() => {});
    } catch (e) {
      setError("기존 캡처 삭제 실패: " + e.message);
      setBusy(false);
      return;
    }
    setBusy(false);
    await runSave(dup.name, dup.recapture);
  }, [dup, runSave]);

  const dupKeepBoth = useCallback(async () => {
    if (!dup) return;
    const list = await capturesApi.list().catch(() => []);
    await runSave(uniqueName(dup.name, list), dup.recapture);
  }, [dup, runSave]);

  const dupCancel = useCallback(() => setDup(null), []);

  // ── 액션: 캡처 저장소 조회/불러오기 ────────
  const loadCaptures = useCallback(() => {
    capturesApi.list().then(setCaptures).catch((e) => setError("저장소 조회 실패: " + e.message));
  }, []);

  const openCapture = useCallback((cap) => {
    setDeviceImg((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return capturesApi.imageUrl(cap.id);
    });
    setCaptureSessionId(cap.id);
    setCaptureSaved(true);
  }, []);

  // 삭제는 휴지통으로. 목록에서만 빼고, 복원은 휴지통 창에서.
  const removeCapture = useCallback(async (id) => {
    try {
      await capturesApi.remove(id);
      setCaptures((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setError("캡처 삭제 실패: " + e.message);
    }
  }, []);

  // ── 액션: 휴지통 ──────────────────────────
  const loadTrash = useCallback(() => {
    capturesApi.listTrash().then(setTrash).catch((e) => setError("휴지통 조회 실패: " + e.message));
  }, []);

  const restoreCapture = useCallback(async (id) => {
    try {
      await capturesApi.restore(id);
      setTrash((prev) => prev.filter((c) => c.id !== id));
      loadCaptures();
    } catch (e) {
      setError("복원 실패: " + e.message);
    }
  }, [loadCaptures]);

  const purgeCapture = useCallback(async (id) => {
    try {
      await capturesApi.purge(id);
      setTrash((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setError("완전 삭제 실패: " + e.message);
    }
  }, []);

  // ── 액션: figma ───────────────────────────
  // 웹 버전은 fileKey 로 REST 를 브라우징했지만, 플러그인은 Figma 에서 지금
  // 선택한 노드를 code.ts 가 밀어준다. 선택이 바뀔 때마다 프레임 이미지/메타/
  // children/spec(색·간격·타이포·스타일)을 받아 그대로 상태에 반영한다.
  useEffect(() => {
    onFigmaSelection(({ frame, imageUrl, children, spec }) => {
      setSelectedFrame(frame);
      setFigmaChildren(children);
      setSelectedChild(null);
      setSpec(frame ? spec : null);
      setFigmaImg((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return imageUrl;
      });
    });
  }, []);

  const selectChild = useCallback(async (child) => {
    setSelectedChild(child);
    if (!child) return;
    setBusy(true);
    try {
      const { imageUrl, spec } = await exportFigmaNode(child.id);
      setFigmaImg((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return imageUrl;
      });
      setSpec(spec);
    } catch (e) {
      setError("컴포넌트 로드 실패: " + e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  // 방향키 미세 이동
  const nudge = useCallback((dx, dy) => {
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  }, []);

  // ── 액션: QA 메모 ─────────────────────────
  // 현재 캡처 세션이 바뀔 때마다 그 세션의 메모를 불러온다.
  useEffect(() => {
    setNotePending(null);
    setActiveNoteId(null);
    if (!captureSessionId) return setNotes([]);
    notesApi.list(captureSessionId).then(setNotes).catch(() => setNotes([]));
  }, [captureSessionId]);

  // 지금 메모에 붙일 수 있는 측정값. 스포이드/자 결과에서 리포트가 쓰는 것만 압축한다
  // (기대값 = 가장 가까운 토큰 / 실제값 = 잰 값 / 차이).
  //
  // 자동으로 붙이지 않는다 — 도구를 바꿔도 이전 측정값이 남아 있어서, 아까 딴 데서 찍은
  // 색이 엉뚱한 메모에 증거로 붙을 수 있다. 무엇이 붙는지 메모 폼에 보여주고 고르게 한다.
  const measures = useMemo(() => {
    const out = [];
    const best = pickResult?.match?.candidates?.[0];
    if (pickResult?.device?.aarrggbb && best) {
      out.push({
        kind: "color",
        label: `스포이드 · ${best.token.name} ΔE ${best.deltaE.toFixed(1)}`,
        actual: pickResult.device.aarrggbb,
        expected: { token: best.token.name, value: best.token.value },
        delta: Number(best.deltaE.toFixed(2)),
        unit: "ΔE",
        at: pickResult.at ?? null, // 어디서 잰 값인지 — 메모 위치와 다를 수 있다
      });
    }
    if (rulerResult?.dp != null && rulerResult.match?.best) {
      out.push({
        kind: "spacing",
        label: `자 · ${rulerResult.dp}dp vs ${rulerResult.match.best.name}`,
        actual: rulerResult.dp,
        expected: { token: rulerResult.match.best.name, value: rulerResult.match.best.value },
        delta: Number(rulerResult.match.diff.toFixed(1)),
        unit: "dp",
        at: rulerResult.first && rulerResult.second ? { from: rulerResult.first, to: rulerResult.second } : null,
      });
    }
    return out;
  }, [pickResult, rulerResult]);

  const addNote = useCallback(
    async (pos, text, category, measure) => {
      if (!captureSessionId || !text.trim()) return;
      try {
        const note = await notesApi.create(captureSessionId, pos, text.trim(), category, measure);
        setNotes((prev) => [...prev, note]);
        setNotePending(null);
      } catch (e) {
        setError("메모 저장 실패: " + e.message);
      }
    },
    [captureSessionId]
  );

  const updateNote = useCallback(
    async (id, text, category) => {
      if (!captureSessionId) return;
      try {
        const note = await notesApi.update(captureSessionId, id, text, category);
        setNotes((prev) => prev.map((n) => (n.id === id ? note : n)));
      } catch (e) {
        setError("메모 수정 실패: " + e.message);
      }
    },
    [captureSessionId]
  );

  const deleteNote = useCallback(
    async (id) => {
      if (!captureSessionId) return;
      try {
        await notesApi.remove(captureSessionId, id);
        setNotes((prev) => prev.filter((n) => n.id !== id));
        setActiveNoteId((cur) => (cur === id ? null : cur));
      } catch (e) {
        setError("메모 삭제 실패: " + e.message);
      }
    },
    [captureSessionId]
  );

  const value = {
    // device
    deviceStatus, deviceImg, hierarchy,
    captureDevice, refreshStatus, requestCapture, openMirror,
    densityInfo, calibrateDensity, resetDensity,
    // 캡처 저장소
    captureSessionId, captureSaved, pendingCapture, cancelRecapture,
    discardAndRecapture, saveAndRecapture,
    pendingSave, requestSave, cancelSave, confirmSave,
    dup, dupOverwrite, dupKeepBoth, dupCancel,
    captures, loadCaptures, openCapture, removeCapture,
    trash, loadTrash, restoreCapture, purgeCapture,
    // figma (플러그인: 선택 push)
    selectedFrame, figmaChildren, selectedChild, selectChild, figmaImg, spec,
    // compare/canvas
    viewMode, setViewMode, overlayOpacity, setOverlayOpacity,
    offset, setOffset, nudge, fineScale, setFineScale,
    tool, setTool, region, setRegion, target, setTarget,
    showBlueprint, setShowBlueprint,
    colorMode, setColorMode,
    // tokens
    tokens, tokensMeta,
    // tool results
    pickResult, setPickResult, rulerResult, setRulerResult,
    // notes
    notes, notePending, setNotePending, activeNoteId, setActiveNoteId,
    addNote, updateNote, deleteNote, measures,
    // ui
    error, setError, busy,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// "이름" 이 이미 있으면 "이름 (2)", 그것도 있으면 "이름 (3)" ...
function uniqueName(base, list) {
  const taken = new Set(list.map((c) => c.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}
