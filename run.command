#!/bin/bash
# 디자인 QA 플러그인 실행기 — 더블클릭하면 준비를 확인하고, 플러그인을 빌드한 뒤
# 헬퍼 서버(기기 캡처용)를 띄운다. 플러그인 UI 는 Figma Desktop 안에서 연다.
# (터미널이 익숙하지 않은 팀원용. 개발자는 npm run build && npm run server 를 써도 된다.)

cd "$(dirname "$0")" || exit 1

# 창이 그냥 닫혀버리면 원인을 못 보니, 실패 시엔 항상 멈춰서 메시지를 보여준다.
die() {
  echo ""
  echo "❌ $1"
  echo ""
  read -r -p "엔터를 누르면 창이 닫힙니다."
  exit 1
}

echo "── 디자인 QA 플러그인 준비 중 ──"
echo ""

# 1) Node.js 확인 — 서버가 node 내장 --env-file-if-exists 를 쓰므로 20.12 이상 필요.
command -v node >/dev/null 2>&1 || die "Node.js가 설치돼 있지 않습니다. 터미널에 아래를 붙여넣어 설치하세요:

   brew install node

   (설치 후 이 파일을 다시 더블클릭하세요. docs/SETUP_TEAM.md 의 \"Node.js 설치하기\" 참고)"

node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>20||(a===20&&b>=12)?0:1)' ||
  die "Node.js 20.12 이상이 필요합니다 (현재 $(node -v)). 터미널에 아래를 붙여넣어 설치하세요:

   brew install node

   (그래도 버전이 그대로면 옛 Node 가 먼저 잡히는 것입니다 — 캡처해서 공유해 주세요.)"
echo "✓ Node.js $(node -v)"

# 2) adb 확인 — 기기 화면 캡처가 adb로 동작하므로 없으면 핵심 기능이 안 된다.
if ! command -v adb >/dev/null 2>&1; then
  die "adb가 설치돼 있지 않습니다. 터미널에 아래를 붙여넣어 설치하세요:

   brew install --cask android-platform-tools

   (Homebrew가 없다면 https://brew.sh 참고 — docs/SETUP_TEAM.md에 설명이 있습니다.)"
fi
echo "✓ adb $(adb version 2>/dev/null | head -1 | sed 's/.*version //')"

# 2-1) scrcpy 확인 — "기기 조작"(미러링)에만 쓴다. 없어도 캡처·대조는 다 되므로
#      알리기만 한다.
if ! command -v scrcpy >/dev/null 2>&1; then
  echo ""
  echo "⚠️  scrcpy가 없습니다 — \"기기 조작\"(폰 미러링) 버튼만 동작하지 않습니다."
  echo "   나머지 기능은 그대로 됩니다. 쓰려면: brew install scrcpy"
  echo ""
else
  echo "✓ scrcpy $(scrcpy --version 2>/dev/null | head -1 | sed 's/^scrcpy \([^ ]*\).*/\1/')"
fi

# 3) 의존성 설치 — 최초 1회, 그리고 git pull 로 의존성이 바뀐 뒤에도.
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
  echo ""
  echo "필요한 파일을 받는 중입니다. 몇 분 걸릴 수 있어요…"
  npm install || die "설치에 실패했습니다. 인터넷 연결을 확인하고 다시 시도하세요."
fi

# 3-1) 이 Mac에 맞는 네이티브 모듈(rollup/esbuild)이 실제로 깔렸는지 확인.
#      npm 의 알려진 버그(npm/cli#4828)로 플랫폼별 optional 패키지가 빠지면 빌드가
#      실패한다. 빠졌으면 조용히 고친다.
case "$(uname -m)" in
  arm64)  PLAT_ARCH="arm64" ;;
  x86_64) PLAT_ARCH="x64" ;;
  *)      PLAT_ARCH="" ;;
esac

heal_native() { # $1 = 부모 패키지(rollup/esbuild), $2 = 필요한 플랫폼 패키지 경로
  local parent="$1" needed="$2" ver
  [ -d "node_modules/$parent" ] || return 0
  [ -d "node_modules/$needed" ] && return 0
  ver=$(node -p "require('./node_modules/$parent/package.json').version" 2>/dev/null) || return 1
  echo ""
  echo "이 Mac에 맞는 모듈($needed)이 빠져 있어 다시 받는 중입니다…"
  npm i "${needed#node_modules/}@${ver}" --no-save >/dev/null 2>&1
  [ -d "node_modules/$needed" ] && return 0
  echo "조금 더 걸립니다. 의존성을 처음부터 다시 설치합니다…"
  rm -rf node_modules
  npm install || return 1
  [ -d "node_modules/$needed" ]
}

if [ -n "$PLAT_ARCH" ]; then
  heal_native rollup  "@rollup/rollup-darwin-${PLAT_ARCH}" ||
    die "필요한 모듈을 설치하지 못했습니다. 터미널에 아래를 붙여넣어 보세요:

   cd ~/design-qa-plugin && rm -rf node_modules package-lock.json && npm install"
  heal_native esbuild "@esbuild/darwin-${PLAT_ARCH}" ||
    die "필요한 모듈을 설치하지 못했습니다. 터미널에 아래를 붙여넣어 보세요:

   cd ~/design-qa-plugin && rm -rf node_modules package-lock.json && npm install"
fi
echo "✓ 의존성 준비됨"

# 4) 플러그인 빌드 — 업데이트를 받은 뒤에도 항상 최신으로 맞춰지도록 매번 빌드한다(수 초).
echo ""
echo "플러그인을 빌드하는 중…"
npm run build >/dev/null 2>&1 || die "빌드에 실패했습니다. 터미널에서 아래를 쳐서 빨간 메시지를 확인해 주세요:

   cd ~/design-qa-plugin && npm run build"
echo "✓ 플러그인 빌드 완료 (figma-plugin/dist)"

# 5) 기기 연결 상태 — 안내만 하고 막지는 않는다 (서버를 켠 뒤 꽂아도 되므로).
if ! adb devices | grep -qE '\sdevice$'; then
  echo ""
  echo "⚠️  USB로 연결된 갤럭시가 아직 안 보입니다."
  echo "   USB 디버깅을 켜고 케이블을 꽂은 뒤, 폰에 뜨는 '허용' 팝업을 눌러주세요."
  echo "   (서버를 켠 다음에 연결해도 됩니다. docs/SETUP_TEAM.md 의 \"갤럭시 연결하기\" 참고)"
fi

# 6) 헬퍼 서버 실행 (플러그인 UI 는 Figma 안에서 연다)
echo ""
echo "── 헬퍼 서버를 실행합니다 (http://localhost:3011) ──"
echo ""
echo "   이제 Figma Desktop 에서 플러그인을 여세요:"
echo "     상단 메뉴 → Plugins → Development → Design QA 대조 (플러그인)"
echo "     (처음이라면 docs/SETUP_TEAM.md 의 \"플러그인 등록하기\" 참고)"
echo ""
echo "   이 터미널 창을 닫으면 기기 캡처가 멈춥니다. 종료하려면 Control+C."
echo ""

npm run server

echo ""
read -r -p "서버가 종료됐습니다. 엔터를 누르면 창이 닫힙니다."
