// figma 어댑터 — X-Figma-Token 붙은 fetch 래퍼. 모든 figma REST 호출이 여기서만. (§7)
// FIGMA_TOKEN 은 서버에서만 사용, 클라이언트로 절대 노출 금지.
import { config } from "../config.js";

const TIMEOUT_MS = 30000;

// fetch 는 4xx/5xx 에 throw 하지 않으므로 여기서 status 붙은 Error 로 정규화한다.
async function request(url, headers) {
  let res;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    // 네트워크 실패/타임아웃 — figma 가 준 status 가 없다.
    const err = new Error(`figma API: ${e.message}`);
    err.status = 500;
    throw err;
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = body.err || body.message || msg;
    } catch {}
    const err = new Error(`figma API ${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

// 토큰 붙은 figma REST 호출 → JSON
function api(path, params = {}) {
  if (!config.figmaToken) {
    const err = new Error("FIGMA_TOKEN 미설정 — 서버 .env 를 확인하세요.");
    err.status = 401;
    throw err;
  }
  const url = new URL(path, config.figmaBaseUrl);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, v);
  }
  return request(url, { "X-Figma-Token": config.figmaToken }).then((r) => r.json());
}

export const figmaClient = {
  // GET /v1/files/:fileKey  (전체 트리)
  getFile: (fileKey, params = {}) => api(`/v1/files/${fileKey}`, params),

  // GET /v1/files/:fileKey/nodes?ids=...
  getNodes: (fileKey, ids) => api(`/v1/files/${fileKey}/nodes`, { ids }),

  // GET /v1/images/:fileKey?ids=...&scale=...&format=png → { images: { [id]: url } }
  getImageUrls: (fileKey, ids, scale = 2) =>
    api(`/v1/images/${fileKey}`, { ids, scale, format: "png" }),

  // 이미지 URL → PNG Buffer (서버가 프록시 fetch).
  // 이 URL 은 figma 가 준 S3 주소라 토큰을 붙이지 않는다.
  fetchImage: async (url) => Buffer.from(await (await request(url)).arrayBuffer()),
};
