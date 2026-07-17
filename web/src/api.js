// 백엔드 호출은 이 파일에서만. 컴포넌트가 fetch 를 직접 부르지 말 것.
// 엔드포인트를 추가하면 아래 해당 api 객체에 함수 한 줄만 더한다.

// API 베이스 — 웹(vite dev)에선 "" (프록시가 /api 를 :3001 로 넘김),
// 플러그인 빌드에선 iframe 이 same-origin 서버가 없으므로 절대 주소가 필요.
// figma-plugin 빌드가 VITE_API_BASE=http://localhost:3001 을 주입한다.
const BASE = import.meta.env.VITE_API_BASE || "";

// 공통 fetch — 실패하면 서버가 준 { error } 메시지로 throw.
async function request(url, opts) {
  const res = await fetch(BASE + url, opts);
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      msg = (await res.json()).error || msg;
    } catch {}
    throw new Error(msg);
  }
  return res;
}

const getJson = (url) => request(url).then((r) => r.json());

const sendJson = (url, method, body) =>
  request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => r.json());

// 이미지 엔드포인트 → objectURL (캔버스 로드용)
const getObjectUrl = (url) =>
  request(url)
    .then((r) => r.blob())
    .then((b) => URL.createObjectURL(b));

function qs(params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const tokensApi = {
  all: () => getJson("/api/tokens"),
};

export const deviceApi = {
  status: () => getJson("/api/device/status"),
  // 캡처는 매번 새 이미지 → 캐시버스터 붙임
  capture: () => getObjectUrl(`/api/device/capture?t=${Date.now()}`),
  hierarchy: () => getJson("/api/device/hierarchy"),
  mirror: (screen) => sendJson("/api/device/mirror", "POST", { screen }),
};

export const figmaApi = {
  frames: (fileKey, search) => getJson(`/api/figma/frames${qs({ fileKey, search })}`),
  children: (fileKey, nodeId) => getJson(`/api/figma/children${qs({ fileKey, nodeId })}`),
  image: (fileKey, nodeId, scale) => getObjectUrl(`/api/figma/image${qs({ fileKey, nodeId, scale })}`),
  spec: (fileKey, nodeId) => getJson(`/api/figma/spec${qs({ fileKey, nodeId })}`),
};

export const notesApi = {
  list: (captureId) => getJson(`/api/notes${qs({ captureId })}`),
  // measure: 이 메모를 남길 때 재고 있던 값(있으면). 리포트의 기대값/실제값/차이가 된다.
  create: (captureId, pos, text, category, measure) =>
    sendJson("/api/notes", "POST", { captureId, ...pos, text, category, measure }),
  update: (captureId, id, text, category) =>
    sendJson(`/api/notes/${id}`, "PUT", { captureId, text, category }),
  remove: (captureId, id) => sendJson(`/api/notes/${id}${qs({ captureId })}`, "DELETE"),
  removeAll: (captureId) => sendJson(`/api/notes${qs({ captureId })}`, "DELETE"),
};

export const capturesApi = {
  list: () => getJson("/api/captures"),
  listTrash: () => getJson("/api/captures/trash"),
  imageUrl: (id) => `${BASE}/api/captures/${id}/image`,
  remove: (id) => sendJson(`/api/captures/${id}`, "DELETE"), // 휴지통으로
  restore: (id) => sendJson(`/api/captures/${id}/restore`, "POST"),
  purge: (id) => sendJson(`/api/captures/${id}${qs({ purge: 1 })}`, "DELETE"), // 완전 삭제

  // pngBlob: 기기 캡처 objectURL 을 fetch 해서 얻은 Blob
  // device: { serial, model, width, height, density } — 어느 기기에서 뜬 캡처인지 리포트에 남긴다
  save: (id, { name, nodeId, nodeName, device }, pngBlob) =>
    request(`/api/captures${qs({
      id, name, nodeId, nodeName,
      serial: device?.serial, model: device?.model, w: device?.width, h: device?.height, density: device?.density,
    })}`, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: pngBlob,
    }).then((r) => r.json()),
};
