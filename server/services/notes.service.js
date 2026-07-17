// QA 메모 서비스 — 캡처 세션(captureId)별로 묶어 로컬 JSON 파일에 저장. (express 의존 X)
//
// 메모는 원래 Figma 노드 id 를 키로 썼다가 캡처 세션 id 로 바뀌었다. qa-data/notes.json 의
// `"3546:16891"` 키가 그때의 잔재 — 빈 배열이고 UI 에 안 보이지만 의도적으로 남겨둔 것이라
// 정리하지 말 것.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NOTES_FILE } from "../config.js";

function readAll() {
  if (!existsSync(NOTES_FILE)) return {};
  try {
    return JSON.parse(readFileSync(NOTES_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeAll(data) {
  // qa-data/ 는 gitignore 라 clone 직후엔 없다 — 첫 저장 때 만든다.
  mkdirSync(path.dirname(NOTES_FILE), { recursive: true });
  writeFileSync(NOTES_FILE, JSON.stringify(data, null, 2));
}

export function listNotes(captureId) {
  if (!captureId) return [];
  return readAll()[captureId] || [];
}

// measure: 메모를 남길 때 스포이드/자가 재고 있던 값. 리포트의 기대값/실제값/차이가
// 여기서 나온다. 없을 수도 있다(에셋 교체처럼 잴 게 없는 지적).
//   { kind: "color"|"spacing", actual, expected: { token, value }, delta, unit }
export function addNote(captureId, { x, y, w, h, text, category, measure }) {
  const all = readAll();
  const list = all[captureId] || (all[captureId] = []);
  const note = {
    id: randomUUID(),
    captureId,
    x, y,
    w: w || 0,
    h: h || 0,
    text,
    category,
    measure: measure ?? null,
    createdAt: new Date().toISOString(),
  };
  list.push(note);
  writeAll(all);
  return note;
}

export function updateNote(captureId, id, { text, category }) {
  const all = readAll();
  const note = (all[captureId] || []).find((n) => n.id === id);
  if (!note) return null;
  if (text != null) note.text = text;
  if (category != null) note.category = category;
  writeAll(all);
  return note;
}

export function deleteNote(captureId, id) {
  const all = readAll();
  const list = all[captureId] || [];
  const idx = list.findIndex((n) => n.id === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  writeAll(all);
  return true;
}

// 세션 취소(저장 안 함) 시 그 세션의 메모를 통째로 정리.
export function deleteAllNotes(captureId) {
  const all = readAll();
  if (!(captureId in all)) return false;
  delete all[captureId];
  writeAll(all);
  return true;
}
