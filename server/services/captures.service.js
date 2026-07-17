// QA 캡처 저장소 — 이름 붙여 저장한 기기 캡처(PNG + 메타데이터). (express 의존 X)
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { CAPTURES_DIR, CAPTURES_INDEX_FILE } from "../config.js";

function ensureDir() {
  if (!existsSync(CAPTURES_DIR)) mkdirSync(CAPTURES_DIR, { recursive: true });
}

function readIndex() {
  if (!existsSync(CAPTURES_INDEX_FILE)) return [];
  try {
    return JSON.parse(readFileSync(CAPTURES_INDEX_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeIndex(list) {
  ensureDir();
  writeFileSync(CAPTURES_INDEX_FILE, JSON.stringify(list, null, 2));
}

// id 는 파일명이 되므로 경로 조작(../)이나 구분자가 섞이면 안 된다.
// 캡처 id 는 클라이언트가 만드는 uuid — 그 형태만 허용한다.
const ID_RE = /^[0-9a-fA-F-]{8,64}$/;

function assertSafeId(id) {
  if (typeof id !== "string" || !ID_RE.test(id)) {
    const err = new Error("잘못된 캡처 id 입니다.");
    err.status = 400;
    throw err;
  }
  return id;
}

function imagePath(id) {
  return path.join(CAPTURES_DIR, `${assertSafeId(id)}.png`);
}

// 메타데이터 목록(이미지 바이트는 제외 — 목록/저장소 UI 용)
// 휴지통에 있는 것(deletedAt)은 빼고 준다.
export function listCaptures() {
  return readIndex()
    .filter((c) => !c.deletedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// 휴지통 — 버린 순서대로(최근 것 먼저).
export function listTrash() {
  return readIndex()
    .filter((c) => c.deletedAt)
    .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

// device: 캡처를 뜬 기기. 같은 화면도 기기마다 결과가 달라서 리포트에 꼭 필요하다.
//   { serial, model, width, height, density }
export function saveCapture({ id, name, nodeId, nodeName, device, pngBuffer }) {
  ensureDir();
  writeFileSync(imagePath(id), pngBuffer);
  const list = readIndex();
  const entry = {
    id,
    name: name || id,
    nodeId: nodeId || null,
    nodeName: nodeName || null,
    device: device ?? null,
    createdAt: new Date().toISOString(),
  };
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) list.push(entry);
  else list[idx] = entry;
  writeIndex(list);
  return entry;
}

export function getCaptureImagePath(id) {
  const p = imagePath(id);
  return existsSync(p) ? p : null;
}

// 휴지통으로 — PNG 도 메모도 그대로 두고 표시만 남긴다. 그래서 복원이 공짜다.
// (같은 id 로 다시 저장하면 saveCapture 가 항목을 통째로 갈아끼워 자연히 되살아난다)
export function trashCapture(id) {
  const list = readIndex();
  const entry = list.find((c) => c.id === id);
  if (!entry || entry.deletedAt) return false;
  entry.deletedAt = new Date().toISOString();
  writeIndex(list);
  return true;
}

export function restoreCapture(id) {
  const list = readIndex();
  const entry = list.find((c) => c.id === id);
  if (!entry?.deletedAt) return false;
  delete entry.deletedAt;
  writeIndex(list);
  return true;
}

// 완전 삭제 — 여기서만 실제로 파일이 사라진다.
export function purgeCapture(id) {
  const list = readIndex();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  writeIndex(list);
  const p = imagePath(id);
  if (existsSync(p)) unlinkSync(p);
  return true;
}
