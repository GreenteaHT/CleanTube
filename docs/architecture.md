# 구조

WXT가 `entrypoints/` 폴더를 읽어 manifest를 만든다. `wxt.config.ts`에는 파일 구조로 알 수 없는 것(이름, 설명, 권한)만 적는다.

## 큰 그림

```
popup / options (React)
    |  update()
    v
chrome.storage.sync  "sync:settings"  (Settings 객체 하나)
    |  watch()   팝업, 옵션, 콘텐츠 스크립트가 각자 구독
    v
entrypoints/youtube.content/index.ts
    |  MutationObserver + yt-navigate-finish  ->  applyAll()
    v
data-cleantube="hide|blur" 속성  ->  style.css 가 실제로 숨기거나 흐리게
```

세 곳이 storage 항목 하나를 공유하고, 서로 메시지를 주고받지 않는다. 그래서 `background.ts`는 지금 아무 일도 하지 않는다.

## 엔트리포인트

| 경로 | manifest 항목 | 역할 |
|---|---|---|
| `youtube.content/index.ts` | content_scripts | `*://*.youtube.com/*`에서 실행. 스캔과 마킹 |
| `youtube.content/style.css` | content_scripts.css | `data-cleantube` 속성 값에 따라 `display:none` 또는 blur |
| `popup/` | action.default_popup | 켜기/끄기, 모드, 키워드 빠른 추가, 쇼츠·댓글 토글 |
| `options/` | options_ui | 키워드·채널 목록 편집, 초기화 |
| `background.ts` | background.service_worker | 비어 있음 |

## 설정

`utils/settings.ts`가 유일한 정의처다.

| 필드 | 타입 | 의미 |
|---|---|---|
| `enabled` | boolean | 전체 켜기/끄기. 끄면 모든 속성을 제거한다 |
| `mode` | `'hide' \| 'blur'` | 숨김 방식 |
| `keywords` | string[] | 제목이나 댓글 본문에 포함되면 숨김. 대소문자 무시, 부분 일치 |
| `channels` | string[] | 채널명 또는 @핸들. 대소문자 무시, 정확히 일치 |
| `hideAllComments` | boolean | 댓글 섹션 통째로 숨김 |
| `hideShorts` | boolean | 쇼츠 카드와 쇼츠 선반 숨김 |

`storage.defineItem('sync:settings', { fallback })`으로 정의한다. `sync:`는 `chrome.storage.sync`라 같은 크롬 계정의 다른 기기와 동기화된다. 항목당 8KB 한도가 있다.

## 콘텐츠 스크립트

시작하면 설정을 읽고 `applyAll()`을 한 번 돌린 뒤 세 가지를 구독한다.

1. `MutationObserver`가 `document.documentElement`의 자식 변경 전체를 감시한다. 변경이 몰려와도 150ms에 한 번만 스캔한다.
2. `yt-navigate-finish` 이벤트. 유튜브는 SPA라 페이지를 옮겨도 스크립트가 다시 실행되지 않는다. 이 이벤트가 이동 완료 신호다.
3. `settingsItem.watch()`. 팝업이나 옵션에서 설정을 바꾸면 즉시 다시 스캔한다.

`applyAll()`은 `enabled`가 꺼져 있으면 모든 속성을 제거하고 끝낸다. 켜져 있으면 영상 카드, 쇼츠 선반, 댓글 순서로 처리한다.

각 요소마다 `evaluate*()`가 숨길 이유 문자열 또는 `null`을 돌려주고, `mark()`가 속성을 붙이거나 뗀다. 이미 같은 값이면 건드리지 않아서 불필요한 DOM 쓰기를 피한다.

### 이유 문자열

`data-cleantube-reason` 속성에 남는다. DevTools에서 왜 숨겨졌는지 바로 볼 수 있다.

- `shorts`
- `keyword:<매칭된 키워드>`
- `channel:<매칭된 채널 항목>`
- `all-comments`

### 유튜브 셀렉터

유튜브는 화면마다 다른 커스텀 엘리먼트를 쓰고 자주 바뀐다. 셀렉터는 `index.ts` 상단에 모여 있다.

| 상수 | 대상 |
|---|---|
| `VIDEO_SELECTOR` | 영상 카드 컨테이너. 홈 그리드, 검색, 재생 페이지 추천, 채널, 재생목록, 신형 `yt-lockup-view-model` |
| `TITLE_SELECTORS` | 카드 안 제목. 순서대로 시도 |
| `CHANNEL_SELECTORS` | 카드 안 채널명. 순서대로 시도 |
| `COMMENT_SELECTOR` | 개별 댓글. 최상위와 답글 모두 |
| `SHORTS_SHELF_SELECTOR` | 홈·구독 피드의 쇼츠 선반 |

신형 카드 `yt-lockup-view-model`은 `ytd-rich-item-renderer` 안에 들어 있는 경우가 있다. 안쪽을 숨기면 그리드에 빈 칸이 남으므로 바깥 컨테이너 기준으로 모아서 처리한다.

채널 식별은 채널명 텍스트와 `a[href*="/@"]` 링크에서 뽑은 `@핸들`을 모두 후보로 넣는다. 사용자가 어느 쪽을 입력해도 매칭된다.

## 매칭

`utils/matcher.ts`. 문자열만 받고 문자열만 돌려준다.

- `findKeyword(text, keywords)` 정규화(trim, 소문자) 후 부분 일치. 매칭된 키워드 원문을 돌려준다.
- `findChannel(candidates, blocked)` 정규화 후 앞의 `@`를 떼고 정확 일치. 여러 후보 중 하나라도 맞으면 그 차단 항목 원문을 돌려준다.

## UI

- `hooks/useSettings.ts` `getValue()`로 초기값을 읽고 `watch()`로 구독한다. `update(patch)`는 최신 값을 다시 읽어 병합한 뒤 저장한다. 다른 창에서 바꾼 값을 덮어쓰지 않기 위해서다.
- `components/ListEditor.tsx` 문자열 목록 추가·삭제. 대소문자 무시 중복 검사. 키워드와 채널 목록에 같이 쓴다.
- `assets/base.css` 팝업과 옵션 공통 스타일. 각 엔트리포인트의 `App.css`가 덧붙인다.
