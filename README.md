# CleanTube

유튜브 영상과 댓글을 키워드·채널 기준으로 숨기거나 흐리게 처리하는 크롬 확장기능.
[WXT](https://wxt.dev) + React + TypeScript로 만들었다.

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
  youtube.content/   유튜브 페이지 안에서 실행. DOM을 감시해서 영상·댓글을 숨긴다.
    index.ts         MutationObserver + 매칭 로직 호출 + data-cleantube 속성 토글
    style.css        data-cleantube 속성에 따라 display:none 또는 blur
  popup/             툴바 아이콘 팝업 (React). 켜기/끄기, 모드, 키워드 빠른 추가
  options/           상세 설정 페이지 (React). 키워드·채널 목록 관리
  background.ts      서비스 워커. 지금은 아무것도 안 함
components/
  ListEditor.tsx     문자열 목록 추가·삭제 UI
hooks/
  useSettings.ts     settings 읽기·쓰기·구독 훅
utils/
  settings.ts        Settings 타입 + chrome.storage.sync 정의
  matcher.ts         순수 매칭 함수 (DOM 의존 없음)
assets/
  base.css           팝업·옵션 공통 스타일
wxt.config.ts        manifest에 들어갈 name, permissions 등
```

WXT가 `entrypoints/` 구조를 읽어서 `manifest.json`을 자동 생성한다.
생성 결과는 빌드 후 `.output/chrome-mv3/manifest.json`에서 확인할 수 있다.

## 동작 방식

1. 콘텐츠 스크립트가 유튜브 페이지에 주입되면 `chrome.storage.sync`에서 설정을 읽는다.
2. `MutationObserver`로 DOM 변경을 감시한다. 유튜브는 SPA라 페이지 이동 시 스크립트가
   다시 실행되지 않으므로, 새 요소가 붙을 때마다 다시 스캔한다.
3. 영상 카드(`ytd-rich-item-renderer` 등)와 댓글(`ytd-comment-view-model`)을 찾아
   제목·채널·본문을 읽고, 설정의 키워드·채널과 비교한다.
4. 매칭되면 `data-cleantube="hide|blur"` 속성을 붙인다. 실제 숨김은 CSS가 담당한다.
   DOM을 지우지 않으므로 설정을 바꾸면 즉시 되돌아온다.
5. 팝업·옵션에서 설정을 바꾸면 `storage.watch()`로 콘텐츠 스크립트가 즉시 반영한다.

디버깅할 때는 개발자 도구에서 `[data-cleantube]`를 검색하면 숨겨진 요소와
`data-cleantube-reason` 속성으로 숨긴 이유를 볼 수 있다.

## 유의사항

- 유튜브 DOM 구조는 예고 없이 바뀐다. 셀렉터는 `entrypoints/youtube.content/index.ts` 상단에
  모아뒀으니 안 먹히면 거기부터 확인.
- `chrome.storage.sync`는 항목당 8KB 제한이 있다. 키워드를 수백 개 이상 넣으면
  `local`로 바꾸는 것을 고려.
- 다른 사이트를 추가하려면 `entrypoints/<사이트>.content/` 폴더를 만들고
  `matches`와 셀렉터만 바꾸면 된다. `utils/matcher.ts`는 그대로 재사용.
