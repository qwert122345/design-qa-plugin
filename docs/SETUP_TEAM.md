# 처음 세팅하기 — 디자인 QA 플러그인

Figma 디자인과 실제 갤럭시 화면을 나란히/겹쳐놓고 색·간격·레이아웃을 대조하는 **Figma 플러그인**입니다.
디자인은 Figma 캔버스에서 프레임을 **선택만** 하면 자동으로 들어오고, 기기 화면은 **내 Mac에서 도는 작은
서버**가 USB로 연결된 갤럭시에서 가져옵니다.

> 터미널(검은 창)을 몇 번 씁니다. 낯설어도 괜찮아요 — **붙여넣고 엔터**만 하면 됩니다.
> 터미널은 `⌘ + 스페이스` → `터미널` 입력 → 엔터로 엽니다.
>
> 막히면 캡처해서 물어보세요. 잘못 눌러서 뭔가 망가지는 일은 없습니다.

세팅은 7단계, 처음 한 번만 하면 됩니다. (전부 20분쯤)
각 단계 끝에 **확인**이 있습니다. 거기까지 됐으면 다음 단계로 가세요.

> **웹 툴과 달리 Figma 토큰은 필요 없습니다.** 플러그인은 Figma 안에서 도니까, 선택한 프레임을
> 바로 읽습니다. 발급받을 열쇠가 없어 그만큼 간단합니다.

---

## 1. Homebrew 준비하기

프로그램을 설치해 주는 프로그램입니다. 다음 단계에서 이걸로 세 개를 깝니다.

먼저 이미 있는지 봅니다. 터미널에 붙여넣고 엔터:

```
brew --version
```

`Homebrew 4.5.2` 처럼 **버전 숫자가 나오면 이미 있는 것이니 이 단계는 건너뛰세요.**

`command not found`가 나오면 설치해야 합니다. 아래를 붙여넣고 엔터, Mac 로그인 비밀번호를
물으면 입력하세요(**화면에 아무것도 안 찍히는 게 정상**입니다. 그냥 치고 엔터).

```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

설치가 끝나면 터미널이 `Next steps:` 라며 붙여넣으라는 줄(`eval "$(/opt/homebrew/bin/brew shellenv)"`
같은 것)을 알려줍니다. **그 줄을 그대로 붙여넣고 엔터하세요.** 이걸 빠뜨리면 다음 단계에서
다시 `command not found`가 납니다.

**확인:** `brew --version`에 버전이 나오면 성공.

---

## 2. 프로그램 3개 설치하기

터미널에 **한 줄씩** 붙여넣고 엔터. (각각 1~2분 걸립니다)

```
brew install --cask android-platform-tools
```

```
brew install scrcpy
```

```
brew install gh
```

각각 이런 것들입니다.

| | 하는 일 |
|---|---|
| android-platform-tools | `adb` — 폰 화면을 Mac으로 가져옵니다 |
| scrcpy | 폰 화면을 Mac에서 마우스로 조작합니다 (플러그인의 "기기 조작" 버튼) |
| gh | 다음 단계에서 플러그인을 내려받을 때 GitHub 로그인에 씁니다 |

**확인:** 아래 세 줄을 차례로 쳐서 전부 버전이 나오면 성공.

```
adb version
scrcpy --version
gh --version
```

---

## 3. Node.js 설치하기

헬퍼 서버를 실행하는 엔진입니다. 1번처럼, 먼저 이미 있는지 봅니다.

```
node -v
```

`v20.12` 이상(`v22`, `v24` 등 숫자가 더 크면 다 괜찮습니다)이 나오면 **이 단계는 건너뛰세요.**

`command not found`거나 숫자가 `v20.12`보다 낮으면 설치합니다.

```
brew install node
```

> 예전에 nodejs.org에서 받아 설치한 Node가 있는데 버전이 낮은 경우라면, 위 명령을 친 뒤에도
> `node -v`가 그대로일 수 있습니다(둘이 깔려서 옛 것이 먼저 잡히는 것). 그럴 땐 캡처해서
> 알려주세요 — 흔한 일이고 한 줄로 고칩니다.

**확인:** `node -v`를 다시 쳐서 `v20.12` 이상이 나오면 성공.

---

## 4. Figma Desktop 앱 설치하기

플러그인은 **Figma 데스크톱 앱 안에서만** 돌아갑니다(웹 브라우저의 Figma로는 개발 플러그인을
등록할 수 없습니다).

1. https://www.figma.com/downloads/ 에서 **Desktop app**을 받아 설치
2. 초대받은 계정으로 로그인

**확인:** Figma 앱을 열고 상단 메뉴에 **Plugins**가 보이면 성공.

---

## 5. 플러그인 내려받기

비공개 저장소라 **GitHub 로그인이 먼저** 필요합니다. 2단계에서 깐 `gh`로 합니다.

```
gh auth login --hostname github.com --git-protocol https --web
```

그러면 이렇게 진행됩니다.

1. 터미널에 **8자리 코드**가 나옵니다 (`XXXX-XXXX` 모양). 눈으로 기억하거나 복사해 두세요.
2. 엔터를 누르면 브라우저가 열립니다.
3. 브라우저에 그 코드를 넣고, **초대받은 계정으로** 로그인 → 권한 허용.
4. 터미널로 돌아오면 `✓ Logged in as ...`가 찍혀 있습니다.

> 평소 웹에서 GitHub에 로그인하듯 하면 됩니다. **비밀번호를 터미널에 치는 게 아닙니다** —
> 터미널이 비밀번호를 물어보면 뭔가 잘못된 것이니 알려주세요.

로그인이 끝났으면 플러그인을 내려받습니다. (내 계정 폴더 아래에 `design-qa-plugin` 폴더가 생깁니다)

```
gh repo clone qwert122345/design-qa-plugin ~/design-qa-plugin
```

**확인:** `ls ~/design-qa-plugin`를 쳐서 `run.command`, `figma-plugin`, `server` 같은 게 보이면 성공.

> `Repository not found`가 나오면 아직 저장소 초대가 안 된 것이니 알려주세요.

---

## 6. 갤럭시 연결하기

1. 폰: **설정 → 휴대전화 정보 → 소프트웨어 정보 → 빌드번호**를 **7번 연타**
   → "개발자가 되었습니다" 문구가 뜹니다.
2. 폰: **설정 → 개발자 옵션 → USB 디버깅** 켜기
3. USB 케이블로 폰을 Mac에 연결
4. 폰에 뜨는 **"USB 디버깅을 허용하시겠습니까?"** 팝업에서 **허용**
   (**이 컴퓨터에서 항상 허용**을 체크하면 다음부터 안 물어봅니다)

> 케이블이 충전 전용이면 인식되지 않습니다. 팝업이 안 뜨면 다른 케이블로 시도해 보세요.

**확인:** 터미널에 `adb devices`를 치면 기기 번호 옆에 `device`라고 나오면 성공입니다.
`unauthorized`면 폰의 허용 팝업을 아직 안 누른 것이고, 아무것도 없으면 케이블/USB 디버깅을
다시 확인하세요.

---

## 7. 플러그인 등록하기 (Figma에 한 번만)

먼저 `design-qa-plugin` 폴더를 Finder에서 열고 **`run.command`를 더블클릭**합니다.
검은 터미널 창이 뜨면서 준비 상태를 점검하고, 플러그인을 빌드한 뒤, **헬퍼 서버**를 띄웁니다.
(첫 실행 때는 필요한 파일을 받느라 몇 분 걸립니다. 창을 닫지 말고 기다려 주세요.)

> 더블클릭했더니 "확인되지 않은 개발자" 경고가 뜨면: 파일을 **우클릭 → 열기 → 열기**로 한 번만
> 허용하면 됩니다.

빌드가 끝나면(`✓ 플러그인 빌드 완료`) Figma에 등록합니다. **이 등록은 처음 한 번만 하면 됩니다.**

1. Figma Desktop → 상단 메뉴 **Plugins → Development → Import plugin from manifest…**
2. 파일 선택 창에서 `~/design-qa-plugin/figma-plugin/manifest.json` 을 고릅니다.
3. 이제 **Plugins → Development** 아래에 **"Design QA 대조 (플러그인)"** 이 생깁니다.

**확인:** 아무 Figma 파일이나 열고 **Plugins → Development → Design QA 대조 (플러그인)** 을 실행했을 때
플러그인 창이 뜨고 좌측에 **"토큰 118개 로드됨"** 이 보이면 성공입니다.
(검은 화면이거나 "헬퍼 서버에 연결할 수 없습니다"가 뜨면, `run.command` 터미널 창이 켜져 있는지
확인하세요.)

---

## 쓰는 법 (매번)

1. `design-qa-plugin` 폴더의 **`run.command`를 더블클릭** → 헬퍼 서버가 켜집니다(그 창은 켜둔 채로).
2. Figma Desktop에서 **Plugins → Development → Design QA 대조 (플러그인)** 실행.
3. 갤럭시를 USB로 연결하고, 플러그인에서 **화면 캡처** → Figma에서 프레임 선택 → 대조.

자세한 사용법은 [`GUIDE.md`](GUIDE.md)에 있습니다.

**끄는 법:** 터미널 창에서 `Control + C`를 누르거나 창을 닫으면 헬퍼 서버가 꺼집니다.
(플러그인 창은 Figma에서 닫으면 됩니다.)

---

## 업데이트 받기

기능이 추가되면 터미널에 아래를 붙여넣고, 다시 `run.command`를 더블클릭하면 끝입니다.
(`run.command`가 자동으로 다시 빌드하므로 Figma에 재등록할 필요는 없습니다.)

```
cd ~/design-qa-plugin && git pull
```

---

## 잘 안 될 때

| 증상 | 해결 |
|---|---|
| `brew: command not found` (1번 이후에도) | Homebrew 설치 끝에 나온 `Next steps:` 줄을 안 붙여넣은 것. 1번 마지막 참고 |
| `gh auth login`이 비밀번호를 물어봄 | `--web`을 빠뜨린 것. 5번의 명령을 통째로 다시 붙여넣으세요 |
| `gh repo clone`에 `Repository not found` | 저장소 초대가 아직이거나, 로그인 계정이 다른 것. `gh auth status`로 계정 확인 후 공유 |
| 더블클릭했더니 "권한이 없습니다" | 터미널에서 `chmod +x ~/design-qa-plugin/run.command` 실행 후 다시 |
| 더블클릭했더니 "확인되지 않은 개발자" | 파일 우클릭 → 열기 → 열기 (한 번만) |
| 터미널 창이 켜졌다가 바로 닫힘 | 창에 뜬 빨간 메시지를 캡처해서 공유 |
| Figma에 플러그인이 안 보임 | 7번 재등록(Import from manifest). **Figma 웹이 아니라 Desktop 앱**인지 확인 |
| 플러그인이 **검은 화면** | `run.command` 창이 켜져 있는지 확인 → 플러그인 창을 닫았다 다시 실행 |
| "헬퍼 서버에 연결할 수 없습니다" | `run.command`를 더블클릭해 서버를 켜두세요(그 창을 닫으면 안 됩니다) |
| "빌드에 실패했습니다" | 터미널에서 `cd ~/design-qa-plugin && rm -rf node_modules package-lock.json && npm install` 후 다시 |
| **화면 캡처**가 안 됨 | 케이블 확인 → `adb devices`가 `device`로 나오는지 확인 (6번) |
| `adb devices`가 `unauthorized` | 폰의 허용 팝업을 누른 뒤에도 그대로면 `adb kill-server && adb start-server` 후 다시 |
| `adb devices`에 아무것도 없음 | 충전 전용이 아닌 케이블인지, 폰 USB 모드가 **파일 전송(MTP)**인지 확인 |
| "기기 조작"(미러링) 버튼만 안 됨 | `brew install scrcpy` 후 `run.command` 다시 |
| 그 외 | 터미널/플러그인 콘솔 캡처해서 공유 — 대부분 위 중 하나입니다 |
