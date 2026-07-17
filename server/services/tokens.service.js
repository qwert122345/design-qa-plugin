// 토큰 서비스 — §5 파일들을 파싱해 통합 토큰 인덱스를 구축한다. (express 의존 X)
// 서버 시작 시 1회 빌드 후 메모리에 캐시.
import { readFileSync } from "node:fs";
import { TOKEN_FILES, tokenPath } from "../config.js";
import { parseColorFile } from "../parsers/tokens/color.js";
import { parseScaleFile } from "../parsers/tokens/scale.js";
import { parseTypographyStyles, parsePrimitiveText } from "../parsers/tokens/typography.js";

let _cache = null;

function readJson(rel) {
  return JSON.parse(readFileSync(tokenPath(rel), "utf8"));
}

// 통합 토큰 인덱스 빌드. 값이 없는 리프를 만나도 throw 하지 않고 unresolved 플래그로 넘어간다.
export function buildTokenIndex() {
  const tokens = [];
  const warnings = [];

  // 1) 색 (파일 4개)
  for (const f of TOKEN_FILES.color) {
    try {
      const json = readJson(f.path);
      tokens.push(...parseColorFile(json, { kind: f.kind, mode: f.mode }));
    } catch (e) {
      warnings.push(`color 파싱 실패 [${f.path}]: ${e.message}`);
    }
  }

  // 2) 간격 (Spacing/Radius/Stroke)
  for (const f of TOKEN_FILES.scale) {
    try {
      tokens.push(...parseScaleFile(readJson(f.path)));
    } catch (e) {
      warnings.push(`scale 파싱 실패 [${f.path}]: ${e.message}`);
    }
  }

  // 3) 타이포 (조립표 + primitive 참조값)
  let primitives = null;
  try {
    primitives = parsePrimitiveText(readJson(TOKEN_FILES.typography.primitives));
  } catch (e) {
    warnings.push(`typography primitive 파싱 실패: ${e.message}`);
  }
  try {
    const styles = readJson(TOKEN_FILES.typography.styles);
    tokens.push(...parseTypographyStyles(styles, primitives));
  } catch (e) {
    warnings.push(`typography 파싱 실패: ${e.message}`);
  }

  const unresolved = tokens.filter((t) => t.unresolved);

  return {
    tokens,
    primitives,
    warnings,
    meta: buildMeta(tokens, unresolved),
  };
}

function buildMeta(tokens, unresolved) {
  const byCategory = {};
  const byMode = {};
  for (const t of tokens) {
    byCategory[t.category] = (byCategory[t.category] || 0) + 1;
    if (t.mode) byMode[t.mode] = (byMode[t.mode] || 0) + 1;
  }
  return {
    total: tokens.length,
    byCategory,
    byMode,
    unresolvedCount: unresolved.length,
  };
}

// 캐시된 인덱스 반환 (없으면 빌드).
export function getTokenIndex() {
  return (_cache ??= buildTokenIndex());
}
