// Figma 메인 스레드. 1단계에선 UI(디자인 QA React 앱)를 띄우는 역할만 한다.
// 선택 노드의 이미지/spec 을 UI 로 넘기는 배선은 2단계에서 추가된다.
// 어떤 노드도 수정하지 않는다(읽기 전용).

export {}; // ui 코드와 전역 스코프를 공유하지 않도록 모듈로 만든다

figma.showUI(__html__, { width: 1280, height: 860 });

figma.ui.onmessage = (msg) => {
  if (msg && msg.type === "close") {
    figma.closePlugin();
  }
};
