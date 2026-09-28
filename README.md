# CleanTube

유튜브에서 지정한 작성자의 댓글을 숨기는 크롬 확장기능.
[WXT](https://wxt.dev) + React + TypeScript로 만들고 있다. 한 단계씩 기능을 늘려 가는 중이다.

## 지금 되는 것 (1단계)

- 팝업에서 작성자(@핸들 또는 채널명)를 목록에 넣으면 그 사람의 댓글과 답글이 사라진다.
- 목록에서 빼면 바로 다시 보인다.

## 실행

```bash
npm install
npm run dev        # 확장기능이 로드된 크롬이 뜨고, 코드를 고치면 자동 반영
npm run build      # .output/chrome-mv3/ 에 완성본 생성
npm run zip        # 스토어 제출용 zip
npm run compile    # 타입 검사만
```

`npm run dev`가 브라우저를 못 띄우면 `npm run build` 후 크롬에서
`chrome://extensions` → 개발자 모드 → "압축해제된 확장 프로그램을 로드합니다" → `.output/chrome-mv3` 선택.

## 구조

```
entrypoints/
  youtube.content/   유튜브 페이지 안에서 실행. 댓글을 감시해서 작성자를 확인하고 숨긴다.
    index.ts         MutationObserver + 작성자 추출 + data-cleantube-blocked 속성 토글
    style.css        data-cleantube-blocked 속성이 있으면 display:none
  popup/             툴바 아이콘 팝업 (React). 차단 작성자 목록 편집
components/
  ListEditor.tsx     문자열 목록 추가·삭제 UI (+ ListEditor.css)
hooks/
  useSettings.ts     settings 읽기·쓰기·구독 훅
utils/
  settings.ts        Settings 타입 + chrome.storage.sync 정의
  matcher.ts         순수 매칭 함수 (DOM 의존 없음)
assets/
  base.css           팝업 기본 스타일
wxt.config.ts        manifest에 들어갈 name, permissions 등
```

WXT가 `entrypoints/` 구조를 읽어서 `manifest.json`을 자동 생성한다.
생성 결과는 빌드 후 `.output/chrome-mv3/manifest.json`에서 확인할 수 있다.

## 동작 방식

1. 콘텐츠 스크립트가 유튜브 페이지에 주입되면 `chrome.storage.sync`에서 차단 목록을 읽는다.
2. `MutationObserver`로 DOM 변경을 감시한다. 댓글은 스크롤해야 뒤늦게 붙고, 유튜브는 SPA라
   페이지를 옮겨도 스크립트가 다시 실행되지 않으므로, 새 요소가 붙을 때마다 다시 스캔한다.
3. 댓글(`ytd-comment-view-model`)마다 `#author-text`에서 표시 이름과 @핸들을 읽어 차단 목록과 비교한다.
4. 매칭되면 `data-cleantube-blocked="<항목>"` 속성을 붙인다. 실제 숨김은 CSS가 담당한다.
   DOM을 지우지 않으므로 목록에서 빼면 즉시 되돌아온다.
5. 팝업에서 목록을 바꾸면 `storage.watch()`로 콘텐츠 스크립트가 즉시 반영한다.

디버깅할 때는 개발자 도구에서 `[data-cleantube-blocked]`를 검색하면 숨겨진 댓글과
매칭된 항목을 볼 수 있다.

## 유의사항

- 유튜브 DOM 구조는 예고 없이 바뀐다. 셀렉터는 `entrypoints/youtube.content/index.ts` 상단에
  모아뒀으니 안 먹히면 거기부터 확인.
- `chrome.storage.sync`는 항목당 8KB 제한이 있다.

## 문서

- [docs/architecture.md](docs/architecture.md) 구조와 데이터 흐름
- [docs/decisions.md](docs/decisions.md) 설계 결정과 이유
- [docs/backlog.md](docs/backlog.md) 현재 단계의 할 일과 다음 단계 후보
- [CLAUDE.md](CLAUDE.md) 진행 방식, 코딩 규칙, 커밋 양식

## 라이선스

[GPL-3.0](LICENSE)
