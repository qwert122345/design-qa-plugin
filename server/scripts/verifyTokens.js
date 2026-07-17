// 토큰 파싱 결과를 콘솔로 검증 (§8 2단계).
//   npm run tokens:verify
import { buildTokenIndex } from "../services/tokens.service.js";

const { tokens, meta, warnings, primitives } = buildTokenIndex();

const line = (s = "") => console.log(s);
const h = (s) => line(`\n\x1b[1m${s}\x1b[0m`);

h("═══ 통합 토큰 인덱스 요약 ═══");
line(`총 토큰:        ${meta.total}`);
line(`카테고리별:     ${JSON.stringify(meta.byCategory)}`);
line(`모드별:         ${JSON.stringify(meta.byMode)}`);
line(`미해결(unresolved): ${meta.unresolvedCount}`);
if (warnings.length) {
  line(`\n\x1b[33m경고:\x1b[0m`);
  warnings.forEach((w) => line("  - " + w));
}

// 카테고리별 샘플 몇 개씩 보여주기
function sample(category, n = 5) {
  return tokens.filter((t) => t.category === category).slice(0, n);
}

h("── color 샘플 (Normal/Inverse 정규화 #AARRGGBB) ──");
console.table(
  tokens
    .filter((t) => t.category === "color")
    .slice(0, 8)
    .map((t) => ({
      name: t.name,
      mode: t.mode,
      kind: t.kind,
      value: t.value,
      alpha: t.alpha,
      primitive: t.primitive,
      scopes: (t.scopes || []).join(","),
    }))
);

h("── alpha≠1 색 (8bit 합성 확인) ──");
console.table(
  tokens
    .filter((t) => t.category === "color" && t.alpha !== 1)
    .map((t) => ({ name: t.name, mode: t.mode, alpha: t.alpha, value: t.value }))
);

h("── spacing / radius / stroke 샘플 ──");
console.table(
  ["spacing", "radius", "stroke"].flatMap((c) =>
    sample(c, 4).map((t) => ({ category: t.category, name: t.name, dp: t.value, primitive: t.primitive }))
  )
);

h("── typography 샘플 (조립 스펙) ──");
console.table(
  sample("typography", 6).map((t) => ({
    style: t.name,
    font: t.value.font,
    weight: t.value.weight,
    size: t.value.size,
    lineHeight: t.value.lineHeight,
    letterSpacingRef: t.value.letterSpacingRef,
  }))
);

h("── primitive 참조값 (Primitive_Text) ──");
line(JSON.stringify(primitives, null, 2));

line("\n\x1b[32m✓ 토큰 파싱 완료\x1b[0m");
