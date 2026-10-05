# 구조

WXT가 `entrypoints/` 폴더를 읽어 manifest를 만든다. `wxt.config.ts`에는 파일 구조로 알 수 없는 것(이름, 설명, 권한)만 적는다.

## 큰 그림

```
popup (React)                      디버그 패널 (유튜브 화면 안, Shadow DOM)
    |  update()                        |  차단/해제 버튼
    v                                  v
chrome.storage.sync  "sync:settings"  (Settings 객체 하나)
    |  watch()   팝업과 콘텐츠 스크립트가 각자 구독
    v
entrypoints/youtube.content/index.ts              (격리 세계)
    |  MutationObserver  ->  applyAll()
    |
    |  1. document에 cleantube:channel-id-request 이벤트
    |       -> entrypoints/youtube-main.content.ts  (페이지 세계)
    |          댓글 요소에 data-cleantube-channel-id="UC…" 속성
    |  2. 댓글마다 핸들과 채널 ID를 읽어 차단 목록과 비교
    |  3. 읽은 값과 결과를 디버그 패널에 그림 (켜져 있을 때)
    v
댓글 요소에 data-cleantube-blocked="<항목>" 속성  ->  style.css 가 display:none
```

팝업, 패널, 콘텐츠 스크립트가 storage 항목 하나를 공유하고, 서로 메시지를 주고받지 않는다. 패널의 차단 버튼도 storage에 쓰고, 그 변경을 콘텐츠 스크립트가 `watch()`로 받아 화면을 갱신한다. 백그라운드 스크립트는 없다.

## 엔트리포인트

| 경로 | manifest 항목 | 역할 |
|---|---|---|
| `youtube.content/index.ts` | content_scripts | `*://*.youtube.com/*`에서 실행. 댓글 스캔과 마킹 |
| `youtube.content/style.css` | content_scripts.css | `data-cleantube-blocked` 속성이 있으면 `display:none` |
| `youtube.content/panel.ts` + `panel.css` | (index.ts에 번들됨) | 디버그 패널. `panel.css`는 `?inline`으로 문자열로 가져와 Shadow DOM 안에만 넣는다 |
| `youtube-main.content.ts` | content_scripts (`world: MAIN`, `document_start`) | 요청을 받으면 댓글 요소에 채널 ID를 속성으로 적는다 |
| `popup/` | action.default_popup | 차단 작성자 목록 편집 |

## 설정

`utils/settings.ts`가 유일한 정의처다.

| 필드 | 타입 | 의미 |
|---|---|---|
| `blockedAuthors` | string[] | 댓글을 숨길 작성자. @핸들 또는 채널 ID. 핸들은 대소문자와 앞의 @ 무시, 채널 ID는 그대로 비교. 정확히 일치 |
| `debugPanel` | boolean | 유튜브 화면 오른쪽에 디버그 패널을 띄울지. 기본 꺼짐 |

`storage.defineItem('sync:settings', { fallback })`으로 정의한다. `sync:`는 `chrome.storage.sync`라 같은 크롬 계정의 다른 기기와 동기화된다. 항목당 8KB 한도가 있다.

`fallback`은 값이 통째로 없을 때만 쓰인다. 전에 저장된 객체에는 나중에 추가한 필드가 빠져 있으므로, 읽는 쪽은 `loadSettings()`/`withDefaults()`로 `DEFAULT_SETTINGS` 위에 덮어 쓴다.

## 콘텐츠 스크립트

두 개가 서로 다른 세계에서 돈다. 격리 세계는 확장기능 API를 쓸 수 있지만 페이지의 JS 객체가 보이지 않는다. 페이지 세계는 그 반대다. DOM은 둘이 같이 본다.

### 격리 세계: `youtube.content/index.ts`

시작하면 설정을 읽고 `applyAll()`을 한 번 돌린 뒤 두 가지를 구독한다.

1. `MutationObserver`가 `document.documentElement`의 자식 변경 전체를 감시한다. 댓글은 스크롤해야 뒤늦게 붙고, 유튜브는 SPA라 페이지를 옮겨도 스크립트가 다시 실행되지 않기 때문이다. 변경이 몰려와도 150ms에 한 번만 스캔한다. 이 값은 임시다.
2. `settingsItem.watch()`. 팝업에서 목록을 바꾸면 즉시 다시 스캔한다.

`applyAll()`은 먼저 페이지 세계에 채널 ID를 적어 달라고 요청한다. 그다음 모든 댓글 요소를 돌면서 작성자를 읽어 `findAuthor()`에 넘긴다. 매칭되면 `data-cleantube-blocked` 속성에 매칭된 차단 항목을 넣고, 아니면 속성을 뗀다. 이미 같은 값이면 건드리지 않는다. 읽은 값과 결과는 줄 목록으로 모아 패널에 넘긴다.

### 디버그 패널: `youtube.content/panel.ts`

`settings.debugPanel`이 켜져 있으면 WXT `createShadowRootUi`로 `<cleantube-panel>` 호스트를 `body`에 붙이고 그 Shadow DOM 안에 패널을 그린다. 화면 오른쪽 위에 고정. 줄마다 댓글 하나: 핸들, 채널 ID, 매칭된 항목, 차단/해제 버튼. 접을 수 있다.

- 차단 버튼은 채널 ID가 있으면 채널 ID를, 없으면 핸들을 목록에 넣는다. 해제는 매칭된 항목을 목록에서 뺀다. 둘 다 storage에 쓰기만 하고, 화면 갱신은 `watch()` 경로가 한다.
- 스캔 결과가 이전과 같으면 다시 그리지 않는다.
- Shadow DOM 안의 변경은 `MutationObserver`에 잡히지 않으므로 패널을 그려도 스캔이 다시 돌지 않는다.
- `style.css`(댓글 숨김)는 페이지에 적용돼야 해서 `cssInjectionMode: 'ui'`를 쓸 수 없다. 그래서 `panel.css`를 `?inline`으로 문자열로 가져와 `css` 옵션으로 넘긴다.
- React 없이 DOM API로 그린다. 유튜브 모든 페이지에 실리는 스크립트라서.

### 페이지 세계: `youtube-main.content.ts`

채널 ID는 HTML에 없고 유튜브가 댓글 요소에 달아 둔 JS 객체(`el.commentEntity.author.channelId`)에만 있다. 이 스크립트는 `cleantube:channel-id-request` 이벤트를 받으면 모든 댓글 요소에서 그 값을 읽어 `data-cleantube-channel-id` 속성으로 적는다. 값이 없으면 속성을 뗀다.

스스로 DOM을 감시하지 않는다. `dispatchEvent`는 듣는 쪽이 끝나야 돌아오므로, 격리 세계가 스캔 직전에 요청하면 스캔할 때 속성이 항상 최신이다. 감시와 디바운스는 격리 세계 한 곳에만 있다.

`document_start`에 등록한다. 격리 세계(`document_idle`)의 첫 요청보다 먼저 듣고 있어야 하기 때문이다.

### 작성자 읽기

| 값 | 어디서 | 비고 |
|---|---|---|
| 핸들 | 댓글 안 `#author-text`의 글자 | `@handle`. 채널명은 응답에도 DOM에도 없다. 배지가 붙은 댓글은 이 링크가 `hidden`이지만 글자는 남아 있다 |
| 채널 ID | 댓글 요소의 `data-cleantube-channel-id` 속성 | 페이지 세계 스크립트가 적는다. 유튜브 내부 구조가 바뀌어 값을 못 읽으면 비어 있고, 그때는 핸들로만 매칭된다 |

### 유튜브에 기대는 것

유튜브는 화면마다 다른 커스텀 엘리먼트를 쓰고 자주 바뀐다.

| 이름 | 위치 | 대상 |
|---|---|---|
| `COMMENT_SELECTOR` | `utils/youtube.ts` | 개별 댓글. 최상위와 답글 모두. `ytd-comment-view-model`이 현재, `ytd-comment-renderer`는 구형 |
| `#author-text` | `youtube.content/index.ts`의 `readAuthor` | 영상 페이지 댓글 헤더의 작성자 링크 |
| `commentEntity.author.channelId` | `youtube-main.content.ts` | 유튜브가 댓글 요소에 달아 두는 데이터. 셀렉터가 아니라 JS 프로퍼티 |

## 매칭

`utils/matcher.ts`. 문자열만 받고 문자열만 돌려준다.

- `findAuthor(author, blocked)` `author`는 `{ handle, channelId }`. 차단 항목이 채널 ID와 그대로 같거나, trim·소문자·앞의 `@` 제거로 정규화한 핸들과 같으면 그 항목 원문을 돌려준다. 그 값이 그대로 속성에 들어가서 DevTools에서 왜 숨겨졌는지 보인다.

## UI

- `hooks/useSettings.ts` `loadSettings()`로 초기값을 읽고 `watch()`로 구독한다. `update(patch)`는 최신 값을 다시 읽어 병합한 뒤 저장한다. 다른 창에서 바꾼 값을 덮어쓰지 않기 위해서다.
- `entrypoints/popup/App.tsx` 차단 목록 편집과 디버그 패널 토글.
- `components/ListEditor.tsx` 문자열 목록 추가·삭제. 대소문자 무시 중복 검사. 스타일은 옆의 `ListEditor.css`.
- `assets/base.css` 팝업 기본 스타일. 색, 글꼴, 버튼, 입력창.
