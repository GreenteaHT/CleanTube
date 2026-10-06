# CleanTube

유튜브에서 지정한 작성자의 댓글을 가리는 크롬 확장기능.
[WXT](https://wxt.dev) + React + TypeScript로 만들고 있다. 기능을 하나씩 늘려 가는 중이다.

## 지금 되는 것

- **차단**. 댓글에 마우스를 올리면 오른쪽에 CleanTube 버튼이 나타난다. 눌러서 영구 차단이나 임시 차단을 고른다.
  임시 차단은 기간이 지나면 스스로 풀린다. 기간은 팝업에서 정한다(1일·7일·30일 또는 직접 입력, 기본 7일).
  차단된 댓글에서는 같은 메뉴로 해제하거나 영구와 임시를 서로 바꾼다. 완전히 숨긴 댓글은 팝업의 목록에서 푼다.
- **표시 방법**. 차단된 댓글을 어떻게 보일지 영구와 임시에 각각 고른다.
  - 완전히 숨기기. 최상위 댓글이면 답글 묶음까지 스레드째로 접히며 사라진다. (영구의 기본값)
  - 흐리게. 마우스를 올리면 "숨긴 항목 보기"가 나온다. (임시의 기본값)
  - "차단된 댓글"로 바꾸기. 한 줄과 "숨긴 항목 보기"만 남는다.
  - 흐리게와 "차단된 댓글"로 바꾸기는 그 댓글만 가리고 답글은 둔다. 답글까지 가리는 옵션이 있다.
- **목록**. 팝업에서 차단한 작성자를 보고 지운다. @핸들이나 채널 ID를 손으로 넣어도 된다(영구 차단).
  항목을 펼치면 언제, 어느 영상의 어떤 댓글을 보고 차단했는지가 나오고, 그 댓글로 가는 링크가 있다.
- 이미 차단한 작성자의 댓글은 스크롤로 새로 불러와도 원래 모습으로 나타나지 않는다.
- 핸들은 본인이 바꿀 수 있고 채널 ID(`UC…`)는 바뀌지 않는다. 메뉴로 차단하면 채널 ID로 들어간다.
- 팝업에서 "디버그 패널"을 켜면 유튜브 화면 오른쪽에 확장기능이 읽은 댓글 목록(핸들, 채널 ID, 걸린 차단 항목)이
  뜨고, 줄마다 차단/해제 버튼이 있다.

## 실행

```bash
npm install
npm run dev        # 확장기능이 로드된 크롬이 뜨고, 코드를 고치면 자동 반영
npm run build      # .output/chrome-mv3/ 에 완성본 생성
npm run zip        # 스토어 제출용 zip
npm run compile    # 타입 검사만
npm test           # 단위 테스트 (vitest)
```

`npm run dev`가 브라우저를 못 띄우면 `npm run build` 후 크롬에서
`chrome://extensions` → 개발자 모드 → "압축해제된 확장 프로그램을 로드합니다" → `.output/chrome-mv3` 선택.

## 구조

```
entrypoints/
  youtube.content/   유튜브 페이지 안에서 실행. 댓글을 감시해서 작성자를 확인하고 가린다.
    index.ts         MutationObserver + 작성자 읽기 + 스캔 + 만료 타이머
    style.css        페이지에 적용. 세 가지 표시 방법, 가림막, 메뉴 버튼 모양
    display.ts       표시 방법 적용. 무엇을 가릴지, 접히는 애니메이션, "숨긴 항목 보기" 가림막
    menu.ts/.css     댓글 메뉴. 댓글마다 버튼, 드롭다운은 Shadow DOM 안에 하나
    source.ts        차단할 때 그 댓글의 주소, 영상 제목, 내용을 읽는다
    panel.ts/.css    디버그 패널. Shadow DOM 안에 읽은 댓글 목록과 차단/해제 버튼
  youtube-main.content.ts
                     페이지(MAIN) 세계에서 실행. 댓글 요소에 채널 ID를 속성으로 적는다.
  popup/             툴바 아이콘 팝업 (React). 차단 목록, 영구/임시 차단 설정, 디버그 패널 토글
components/
  BlockList.tsx      차단 목록 보기와 편집 (+ BlockList.css)
hooks/
  useSettings.ts     설정 읽기·쓰기·구독 훅
  useBlocked.ts      차단 목록 읽기·쓰기·구독 훅
utils/
  blocklist.ts       차단 목록. chrome.storage.local
  settings.ts        설정. chrome.storage.sync
  matcher.ts         순수 매칭 함수 (DOM 의존 없음)
  duration.ts        기간 상수와 "7일", "3시간" 같은 표기
  youtube.ts         두 콘텐츠 스크립트가 같이 쓰는 셀렉터와 속성·이벤트 이름
tests/               단위 테스트 (matcher, duration)
assets/
  base.css           팝업 기본 스타일
wxt.config.ts        manifest에 들어갈 name, permissions 등
```

WXT가 `entrypoints/` 구조를 읽어서 `manifest.json`을 자동 생성한다.
생성 결과는 빌드 후 `.output/chrome-mv3/manifest.json`에서 확인할 수 있다.

## 동작 방식

1. 콘텐츠 스크립트가 유튜브 페이지에 주입되면 차단 목록(`chrome.storage.local`)과 설정(`chrome.storage.sync`)을 읽는다.
2. `MutationObserver`로 DOM 변경을 감시한다. 댓글은 스크롤해야 뒤늦게 붙고, 유튜브는 SPA라
   페이지를 옮겨도 스크립트가 다시 실행되지 않으므로, 새 요소가 붙을 때마다 다시 스캔한다.
   새로 붙은 댓글은 화면에 칠해지기 전에 바로 처리하고, 전체 스캔은 150ms로 묶는다.
3. 스캔할 때마다 먼저 페이지 세계 스크립트에 요청해서, 댓글 요소마다 작성자의 채널 ID를
   `data-cleantube-channel-id` 속성으로 적게 한다. 채널 ID는 HTML에 없고 유튜브가 요소에 달아 둔
   JS 객체에만 있는데, 그 객체는 페이지 세계에서만 보이기 때문이다.
4. 댓글(`ytd-comment-view-model`)마다 `#author-text`의 @핸들과 위의 채널 ID를 읽어 차단 목록과 비교한다.
   만료된 임시 차단은 건너뛴다.
5. 걸린 항목이 영구인지 임시인지에 따라 설정에서 표시 방법을 고르고, 그에 맞는 속성을 붙인다.
   완전히 숨기기는 `data-cleantube-blocked`, 흐리게와 "차단된 댓글"로 바꾸기는 `data-cleantube-cover`.
   모양은 CSS가 담당한다. 유튜브 DOM을 지우지 않으므로 차단을 풀면 즉시 되돌아온다.
6. 팝업, 댓글 메뉴, 패널 어디서 바꾸든 `storage.watch()`로 콘텐츠 스크립트가 즉시 반영한다.
7. 임시 차단이 풀리는 시각에 타이머를 걸어 다시 스캔한다.

디버깅할 때는 팝업에서 디버그 패널을 켜면 된다. 개발자 도구에서는 `[data-cleantube-blocked]`나
`[data-cleantube-cover]`를 검색하면 가려진 댓글을 볼 수 있다.

## 유의사항

- 유튜브 DOM 구조는 예고 없이 바뀐다. 안 먹히면 댓글 셀렉터(`utils/youtube.ts`),
  작성자 읽기(`entrypoints/youtube.content/index.ts`의 `readAuthor`),
  채널 ID 읽기(`entrypoints/youtube-main.content.ts`),
  스레드와 메뉴 자리(`display.ts`, `menu.ts` 상단의 셀렉터) 순서로 확인.
- 차단 목록은 `chrome.storage.local`에 있어서 다른 기기와 동기화되지 않는다. 설정은 동기화된다.

## 문서

- [docs/architecture.md](docs/architecture.md) 구조와 데이터 흐름
- [docs/decisions.md](docs/decisions.md) 설계 결정과 이유
- [docs/backlog.md](docs/backlog.md) 할 일과 후보
- [CLAUDE.md](CLAUDE.md) 진행 방식, 코딩 규칙, 커밋 양식

## 라이선스

[GPL-3.0](LICENSE)
