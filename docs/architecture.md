# 구조

WXT가 `entrypoints/` 폴더를 읽어 manifest를 만든다. `wxt.config.ts`에는 파일 구조로 알 수 없는 것(이름, 설명, 권한)만 적는다.

## 큰 그림

```
popup (React)
    |  update()
    v
chrome.storage.sync  "sync:settings"  (Settings 객체 하나)
    |  watch()   팝업과 콘텐츠 스크립트가 각자 구독
    v
entrypoints/youtube.content/index.ts
    |  MutationObserver  ->  applyAll()
    v
댓글 요소에 data-cleantube-blocked="<항목>" 속성  ->  style.css 가 display:none
```

팝업과 콘텐츠 스크립트가 storage 항목 하나를 공유하고, 서로 메시지를 주고받지 않는다. 백그라운드 스크립트는 없다.

## 엔트리포인트

| 경로 | manifest 항목 | 역할 |
|---|---|---|
| `youtube.content/index.ts` | content_scripts | `*://*.youtube.com/*`에서 실행. 댓글 스캔과 마킹 |
| `youtube.content/style.css` | content_scripts.css | `data-cleantube-blocked` 속성이 있으면 `display:none` |
| `popup/` | action.default_popup | 차단 작성자 목록 편집 |

## 설정

`utils/settings.ts`가 유일한 정의처다.

| 필드 | 타입 | 의미 |
|---|---|---|
| `blockedAuthors` | string[] | 댓글을 숨길 작성자. @핸들 또는 표시 이름. 대소문자 무시, 앞의 @ 무시, 정확히 일치 |

`storage.defineItem('sync:settings', { fallback })`으로 정의한다. `sync:`는 `chrome.storage.sync`라 같은 크롬 계정의 다른 기기와 동기화된다. 항목당 8KB 한도가 있다.

## 콘텐츠 스크립트

시작하면 설정을 읽고 `applyAll()`을 한 번 돌린 뒤 두 가지를 구독한다.

1. `MutationObserver`가 `document.documentElement`의 자식 변경 전체를 감시한다. 댓글은 스크롤해야 뒤늦게 붙고, 유튜브는 SPA라 페이지를 옮겨도 스크립트가 다시 실행되지 않기 때문이다. 변경이 몰려와도 150ms에 한 번만 스캔한다. 이 값은 임시다.
2. `settingsItem.watch()`. 팝업에서 목록을 바꾸면 즉시 다시 스캔한다.

`applyAll()`은 모든 댓글 요소를 돌면서 작성자 후보를 뽑아 `findAuthor()`에 넘긴다. 매칭되면 `data-cleantube-blocked` 속성에 매칭된 차단 항목을 넣고, 아니면 속성을 뗀다. 이미 같은 값이면 건드리지 않는다.

### 작성자 추출

댓글 안의 `#author-text`에서 두 가지를 모은다.

- 화면에 보이는 텍스트. 보통 `@handle`, 경우에 따라 채널 표시 이름.
- 링크 `href`의 `/@handle` 부분.

사용자가 어느 쪽을 입력해도 매칭되도록 둘 다 후보에 넣는다.

### 유튜브 셀렉터

유튜브는 화면마다 다른 커스텀 엘리먼트를 쓰고 자주 바뀐다. 셀렉터는 `index.ts` 상단에 모여 있다.

| 상수 | 대상 |
|---|---|
| `COMMENT_SELECTOR` | 개별 댓글. 최상위와 답글 모두. `ytd-comment-view-model`이 현재, `ytd-comment-renderer`는 구형 |

## 매칭

`utils/matcher.ts`. 문자열만 받고 문자열만 돌려준다.

- `findAuthor(candidates, blocked)` 양쪽을 trim, 소문자, 앞의 `@` 제거로 정규화한 뒤 정확 일치. 후보 중 하나라도 맞으면 그 차단 항목 원문을 돌려준다. 그 값이 그대로 속성에 들어가서 DevTools에서 왜 숨겨졌는지 보인다.

## UI

- `hooks/useSettings.ts` `getValue()`로 초기값을 읽고 `watch()`로 구독한다. `update(patch)`는 최신 값을 다시 읽어 병합한 뒤 저장한다. 다른 창에서 바꾼 값을 덮어쓰지 않기 위해서다.
- `components/ListEditor.tsx` 문자열 목록 추가·삭제. 대소문자 무시 중복 검사. 스타일은 옆의 `ListEditor.css`.
- `assets/base.css` 팝업 기본 스타일. 색, 글꼴, 버튼, 입력창.
