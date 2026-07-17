// figma 서비스 — figmaClient 어댑터 + figmaSpec 파서 조합. (express 의존 X)
import { figmaClient } from "../adapters/figmaClient.js";
import { config } from "../config.js";
import { collectFrames, collectChildren, refineSpec } from "../parsers/figmaSpec.js";

function resolveFileKey(fileKey) {
  const key = fileKey || config.defaultFileKey;
  if (!key) {
    const err = new Error("fileKey 가 없습니다. (.env DEFAULT_FILE_KEY 또는 쿼리 파라미터)");
    err.status = 400;
    throw err;
  }
  return key;
}

// 4) 프레임 목록 (이름 검색 필터 지원)
// 드롭다운 노이즈 제거: "UI" 페이지 것만, 같은 페이지/이름 중복은 첫 번째만 남긴다.
export async function listFrames(fileKey, search) {
  const key = resolveFileKey(fileKey);
  const file = await figmaClient.getFile(key, { depth: 2 }); // 페이지+프레임 레벨
  let frames = collectFrames(file);

  frames = frames.filter((f) => f.page.includes("UI"));
  const seen = new Set();
  frames = frames.filter((f) => {
    const label = `${f.page}/${f.name}`;
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });

  if (search) {
    const q = search.toLowerCase();
    frames = frames.filter((f) => f.name.toLowerCase().includes(q));
  }
  return frames;
}

// 5) 프레임 하위 인스턴스/컴포넌트
export async function listChildren(fileKey, nodeId) {
  const key = resolveFileKey(fileKey);
  const data = await figmaClient.getNodes(key, nodeId);
  const node = data?.nodes?.[nodeId]?.document;
  return collectChildren(node);
}

// 6) 노드 이미지 PNG (프록시)
export async function getNodeImage(fileKey, nodeId, scale = 2) {
  const key = resolveFileKey(fileKey);
  const data = await figmaClient.getImageUrls(key, nodeId, scale);
  const url = data?.images?.[nodeId];
  if (!url) {
    const err = new Error("이미지 URL 을 받지 못했습니다.");
    err.status = 502;
    throw err;
  }
  return figmaClient.fetchImage(url);
}

// 7) 노드 정제 스펙 (+ styles 이름 해석)
export async function getSpec(fileKey, nodeId) {
  const key = resolveFileKey(fileKey);
  const data = await figmaClient.getNodes(key, nodeId);
  const entry = data?.nodes?.[nodeId];
  const node = entry?.document;
  if (!node) {
    const err = new Error(`노드를 찾을 수 없습니다: ${nodeId}`);
    err.status = 404;
    throw err;
  }
  // 스타일 맵은 nodes 응답의 각 항목 최상위 styles 에 들어온다.
  const stylesMap = entry.styles || {};
  return refineSpec(node, stylesMap);
}
