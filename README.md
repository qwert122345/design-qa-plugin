# Android 디자인 QA 대조 — Figma 플러그인

> ### 👋 디자이너 / QA라면 여기부터
> **[`docs/SETUP_TEAM.md`](docs/SETUP_TEAM.md) — 처음 세팅하기** (터미널 몰라도 됩니다. 20분)
> 세팅을 마쳤다면 **[`docs/GUIDE.md`](docs/GUIDE.md) — 사용법**
>
> 아래 내용은 개발자용입니다. 안 읽으셔도 됩니다.

디자이너가 **Figma 디자인**과 **실제 개발된 안드로이드 화면**을 겹쳐 비교하는 Figma 플러그인.
[웹 툴 버전](https://github.com/qwert122345/design-qa)을 플러그인으로 이식한 것으로, 대조할 디자인을
fileKey/토큰 없이 **Figma 캔버스에서 선택**하면 바로 읽는다. 기기 화면 캡처·QA 메모 저장은 로컬
헬퍼 서버(`server/`)가 담당한다.

Figma 노드는 **읽기 전용** — 어떤 기존 노드도 수정하지 않는다. ("Figma에 추가"만 현재 페이지에
새 이미지 노드를 만든다.)

- 플러그인 UI: Vite + React (`web/`), 단일 HTML 로 인라인 빌드 → `figma-plugin/dist/`
- 플러그인 메인 스레드: `figma-plugin/code.ts` (esbuild → `dist/code.js`)
- 헬퍼 서버: Node + Express (`server/`, 포트 **3011**) — adb 캡처·노트·캡처저장·토큰
- DB 없음 · 인증 없음 · 로컬 전용 · macOS + 갤럭시(안드로이드 실기기)

## 빠른 시작 (개발자)

```bash
nvm use              # node 20
npm install
npm run build        # 플러그인 UI(dist/index.html) + code.js 빌드
npm run server       # 헬퍼 서버(:3011) — 기기 캡처용, 켜둔 채로
```

그다음 Figma Desktop → Plugins → Development → **Import plugin from manifest…** →
`figma-plugin/manifest.json`.

UI 만 고치며 볼 때는 `npm run dev`(vite, :5173) 로 브라우저에서 확인할 수 있다(플러그인
호스트가 없으므로 Figma 선택 push 는 안 오지만 나머지 UI·서버 연동은 동작).

## 구조

| 경로 | 역할 |
|---|---|
| `web/` | 플러그인 UI(React). `src/figmaBridge.js` 가 code.ts ↔ UI postMessage |
| `figma-plugin/code.ts` | Figma 메인 스레드 — 선택 노드 export/spec, 창 resize, 이미지 노드 추가 |
| `figma-plugin/manifest.json` | 플러그인 매니페스트 (`networkAccess` 로 localhost:3011 허용) |
| `server/` | 헬퍼 서버 — `routes`/`services`/`adapters(adb, scrcpy)`/`parsers` |
| `tokens/` | 디자인 토큰 JSON |
| `reference/` | 참고용 — 팀원이 만든 초기 prezel 플러그인 원본 |

## 코드가 바뀐 뒤 반영

- 서버: `Ctrl+C` 로 끄고 `npm run server` 재시작
- 플러그인: `npm run build` 후 Figma에서 플러그인 다시 실행 (재등록 불필요)
- 팀원용 `run.command` 은 더블클릭 시 `npm run build` 를 자동으로 다시 돌린다

## Figma 플러그인 환경 주의 (data: URL / 비보안 컨텍스트)

플러그인 UI 는 `data:` URL 로 로드돼 secure context 가 아니다. 그래서:
- 앱 번들은 **classic 스크립트**여야 함 (inline `type="module"` 미실행) → vite.config 가 iife+후처리
- `localStorage` 접근은 SecurityError → 가드 래퍼
- `crypto.randomUUID` / `navigator.clipboard` 없음 → 폴백 / 대체(이미지는 Figma 노드로 추가)

## 토큰 파싱만 콘솔로 확인

```bash
npm run tokens:verify
```
