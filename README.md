# Design QA Compare (Figma 플러그인)

Figma 디자인 프레임과 실제 구현된 안드로이드 앱 화면을 나란히 비교하고, QA 항목을 정리해 PNG로 핸드오프하는 내부 도구입니다.

Figma 파일은 **읽기 전용**으로만 사용합니다 — 어떤 노드도 수정하지 않습니다.

## 구성

- `figma-plugin/` — Figma 플러그인 본체
- `helper-server/` — QA 진행 중에만 로컬에서 띄우는 작은 서버. `adb`로 에뮬레이터/실기기 화면을 캡처해 플러그인에 전달하는 역할만 합니다.

## 사전 준비

- Figma Desktop 앱
- Node.js 18 이상
- Android platform-tools (`adb`가 PATH에 있어야 함)
- QA할 브랜치/PR의 debug 빌드가 설치된 에뮬레이터 또는 실기기 (USB 디버깅 허용)

## 1. 헬퍼 서버 실행

```bash
cd helper-server
npm install
npm start
```

`http://localhost:4747`에서 대기합니다. QA 세션 동안 계속 켜둔 상태로 두세요.

## 2. 플러그인 빌드

```bash
cd figma-plugin
npm install
npm run build
```

## 3. Figma에 플러그인 설치

Figma Desktop → 우측 상단 메뉴 → Plugins → Development → **Import plugin from manifest…** → `figma-plugin/manifest.json` 선택.

## 사용 흐름

1. Figma에서 플러그인 실행
2. 상단에서 기기 선택 → 처음 쓰는 기기라면 **"밀도 360dp 맞추기"**를 한 번 눌러주세요 (기기의 실제 밀도를 계산해서 자동으로 맞춰줌 — 이후 캡처되는 화면의 텍스트 크기가 Figma와 맞게 됨). 되돌리려면 "밀도 초기화"
3. Figma 캔버스에서 비교할 프레임 1개 선택 → 우측에 자동 표시 (프레임 크기가 px로 함께 표시됨). 프레임을 바꿔 선택하면 이전에 작성 중이던 QA 메모는 자동으로 초기화됩니다
4. 하단에서 chips(typography/color/icon/margin/spacing/radius/typo_error/component)를 선택하고 텍스트로 어긋난 부분과 개선 방향을 적어 QA 항목 추가
5. "PNG로 내보내기" 또는 "Figma에 핸드오프" 클릭 → 클릭 시점에 선택된 기기 화면을 자동으로 캡처한 뒤 진행됨 (별도의 "캡처" 버튼 없음)
   - PNG로 내보내기: 구현 화면을 가로 360px 고정(비율 유지)으로 맞춰 Figma 프레임과 나란히 배치하고 QA 항목을 합친 PNG가 다운로드됨
   - Figma에 핸드오프: 플러그인 전용 "Design QA Handoff" 페이지에 (구현 화면 캡처 + 선택 프레임 복사본 + chip 형태의 QA 목록)을 추가함. 원본 디자인 페이지/프레임은 건드리지 않음

## 문제 해결

- 기기 목록이 "헬퍼 서버 연결 실패"로 뜨면 → `helper-server`가 실행 중인지 확인
- "adb를 찾을 수 없습니다" → Android platform-tools 설치 후 PATH 등록
- 기기가 여러 개 연결되어 있으면 드롭다운에서 원하는 기기를 선택하세요 (`adb devices -l` 기준)
- "DPI 정보를 가져오지 못했습니다"가 표시되면 → 괄호 안에 표시되는 원인(예: 기기 미인증/오프라인)을 확인하세요. 이 경우에도 기기명은 항상 표시되고, PNG/핸드오프는 가로 360px 고정 방식으로 계속 동작합니다
- "밀도 맞추기 실패: 요청 실패 (404 Not Found)" → 헬퍼 서버 코드가 업데이트된 뒤 재시작을 안 한 경우입니다. `helper-server`를 껐다가 다시 `npm start`

## 코드가 바뀐 뒤 반영하는 법

- `helper-server`: 터미널에서 `Ctrl+C`로 끄고 `npm start`로 재시작
- `figma-plugin`: `cd figma-plugin && npm run build` 후, Figma에서 플러그인을 다시 실행(우클릭 → Run, 또는 Plugins → Development 목록에서 다시 선택)
