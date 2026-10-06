# 구조

WXT가 `entrypoints/` 폴더를 읽어 manifest를 만든다. `wxt.config.ts`에는 파일 구조로 알 수 없는 것(이름, 설명, 권한)만 적는다.

WXT의 auto-import는 꺼 두었다(`imports: false`). 켜 두면 `utils/`, `hooks/`, `components/`의 export가 import 없이 전역으로 보여서, storage 항목처럼 모듈 안에 둔 것을 밖에서 쓸 수 있게 된다. WXT API는 `#imports`에서 명시적으로 import한다.

## 큰 그림

```
popup (React)          댓글 메뉴, 디버그 패널 (유튜브 화면 안, Shadow DOM)
    |                      |  영구 차단 / 임시 차단, 차단/해제 버튼
    v                      v
chrome.storage.local "local:blocked"   차단 목록 (BlockEntry[])
chrome.storage.sync  "sync:settings"   설정 (임시 차단 기간, 표시 방법, 디버그 패널)
    |  watchBlocked(), watchSettings()   팝업과 콘텐츠 스크립트가 각자 구독
    v
entrypoints/youtube.content/index.ts              (격리 세계)
    |  MutationObserver  ->  새로 붙은 댓글은 즉시, 전체는 150ms로 묶어 applyAll()
    |  임시 차단이 풀리는 시각에 타이머  ->  applyAll()
    |
    |  1. document에 cleantube:channel-id-request 이벤트
    |       -> entrypoints/youtube-main.content.ts  (페이지 세계)
    |          댓글 요소에 data-cleantube-channel-id="UC…" 속성
    |  2. 댓글마다 핸들과 채널 ID를 읽어 차단 목록과 비교 (만료된 임시 차단은 건너뜀)
    |  3. 걸린 항목이 영구냐 임시냐에 따라 설정에서 표시 방법을 고름
    |  4. 댓글에 메뉴 버튼 붙이기, 읽은 값과 결과를 디버그 패널에 그림 (켜져 있을 때)
    v
표시 방법에 따라 속성을 붙이고 style.css가 처리
  완전히 숨기기       data-cleantube-blocked="<항목 키>"   (답글은 그 답글, 최상위 댓글은 스레드 전체)
  흐리게              data-cleantube-cover="blur"          + "숨긴 항목 보기" 가림막
  "차단된 댓글"로     data-cleantube-cover="placeholder"   + "숨긴 항목 보기" 가림막
```

팝업, 메뉴, 패널, 콘텐츠 스크립트가 storage 항목 둘을 공유하고, 서로 메시지를 주고받지 않는다. 메뉴와 패널의 버튼도 storage에 쓰기만 하고, 그 변경을 콘텐츠 스크립트가 구독으로 받아 화면을 갱신한다. 백그라운드 스크립트는 없다.

storage 항목(`defineItem`)은 `utils/blocklist.ts`와 `utils/settings.ts` 밖으로 내보내지 않는다. 읽기, 쓰기, 구독은 그 두 파일이 내보내는 함수로만 한다. 병합 규칙과 쓰기 규칙이 한 곳에 있게 하려는 것이다.

## 엔트리포인트

| 경로 | manifest 항목 | 역할 |
|---|---|---|
| `youtube.content/index.ts` | content_scripts | `*://*.youtube.com/*`에서 실행. 댓글 스캔과 마킹 |
| `youtube.content/style.css` | content_scripts.css | 페이지에 적용되는 CSS. 세 가지 표시 방법, 가림막, 댓글 메뉴 버튼 모양 |
| `youtube.content/display.ts` | (index.ts에 번들됨) | 표시 방법 적용. 무엇을 가릴지, 바뀔 때의 애니메이션, 가림막 |
| `youtube.content/menu.ts` + `menu.css` | (index.ts에 번들됨) | 댓글 메뉴. `menu.css`는 `?inline`으로 Shadow DOM 안에만 넣는다 |
| `youtube.content/source.ts` | (index.ts에 번들됨) | 차단할 때 그 댓글의 주소, 영상 제목, 내용을 읽는다 |
| `youtube.content/panel.ts` + `panel.css` | (index.ts에 번들됨) | 디버그 패널. `panel.css`는 `?inline`으로 문자열로 가져와 Shadow DOM 안에만 넣는다 |
| `youtube-main.content.ts` | content_scripts (`world: MAIN`, `document_start`) | 요청을 받으면 댓글 요소에 채널 ID를 속성으로 적는다 |
| `popup/` | action.default_popup | 차단 목록, 영구/임시 차단 설정, 디버그 패널 토글 |

## 저장

두 곳에 나눠 둔다.

### 차단 목록: `utils/blocklist.ts`, `local:blocked`

`BlockEntry[]`. `chrome.storage.local`에 둔다. `sync`는 항목당 8KB라 객체 80개 안팎에서 넘치고, `local`은 10MB다. 대신 다른 기기와 동기화되지 않는다.

| 필드 | 타입 | 의미 |
|---|---|---|
| `channelId` | string? | 메뉴나 패널에서 차단하면 들어간다. 있으면 이것으로 매칭한다 |
| `handle` | string? | 손으로 입력한 항목은 이것만 있다. `channelId`가 있을 때는 목록에 보여 줄 이름이기도 하다 |
| `until` | number? | 임시 차단이 풀리는 시각(epoch ms). 없으면 영구 차단 |
| `at` | number? | 차단한 시각(epoch ms). 이 필드가 생기기 전에 만든 항목에는 없다 |
| `source` | `{ url, videoTitle?, text? }`? | 어느 댓글을 보고 차단했는지. 댓글 메뉴나 패널에서 차단했을 때만 있다. 매칭에는 쓰지 않는다 |

- `loadBlocked()` 전체를 읽는다. `watchBlocked(callback)` 변경을 구독한다. 돌려주는 함수로 구독을 푼다.
- `addBlock(entry)` 같은 대상의 기존 항목을 새 항목으로 바꾼다. 임시를 영구로 바꾸거나 기간을 다시 정할 때.
- `removeBlock(entry)` 같은 대상의 항목을 뺀다.
- 둘 다 쓰기 전에 최신 값을 다시 읽고, 만료된 임시 차단을 같이 치운다.
- 만료는 지우는 게 아니라 무시하는 것이다. 매칭이 만료된 항목을 건너뛰므로 치우는 건 다음에 쓸 때로 미뤄도 된다.

### 설정: `utils/settings.ts`, `sync:settings`

| 필드 | 타입 | 의미 |
|---|---|---|
| `temporaryDurationMs` | number | 댓글 메뉴의 "임시 차단"이 차단하는 기간(ms). 기본 7일. 바꿔도 이미 걸어 둔 임시 차단은 그대로다 |
| `display.permanent` | `'hide' \| 'blur' \| 'placeholder'` | 영구 차단된 댓글의 표시 방법. 기본 `hide` |
| `display.temporary` | 같음 | 임시 차단된 댓글의 표시 방법. 기본 `blur` |
| `coverReplies` | boolean | `blur`나 `placeholder`일 때 최상위 댓글의 답글까지 가릴지. 기본 꺼짐. `hide`는 이 값과 상관없이 스레드째 숨긴다 |
| `debugPanel` | boolean | 유튜브 화면 오른쪽에 디버그 패널을 띄울지. 기본 꺼짐 |

`sync:`는 `chrome.storage.sync`라 같은 크롬 계정의 다른 기기와 동기화된다.

- `loadSettings()` 전체를 읽는다. `watchSettings(callback)` 변경을 구독한다.
- `updateSettings(patch)` 최신 값을 다시 읽어 병합한 뒤 저장하고, 병합한 결과를 돌려준다. 다른 창에서 바꾼 값을 덮어쓰지 않기 위해서다. `display`는 한쪽만 넘겨도 된다(`SettingsPatch`).

`fallback`은 값이 통째로 없을 때만 쓰인다. 전에 저장된 객체에는 나중에 추가한 필드가 빠져 있으므로, 읽고 구독하는 함수가 `DEFAULT_SETTINGS` 위에 덮어 쓴다. `display`는 안쪽 객체라 한 겹 더 덮어 쓴다.

## 콘텐츠 스크립트

두 개가 서로 다른 세계에서 돈다. 격리 세계는 확장기능 API를 쓸 수 있지만 페이지의 JS 객체가 보이지 않는다. 페이지 세계는 그 반대다. DOM은 둘이 같이 본다.

### 격리 세계: `youtube.content/index.ts`

시작하면 설정과 차단 목록을 읽고 `applyAll()`을 한 번 돌린 뒤 네 가지에 반응한다.

1. `MutationObserver`가 `document.documentElement`의 자식 변경 전체를 감시한다. 댓글은 스크롤해야 뒤늦게 붙고, 유튜브는 SPA라 페이지를 옮겨도 스크립트가 다시 실행되지 않기 때문이다. 콜백은 두 가지를 한다.
   - 새로 붙은 댓글은 그 자리에서 바로 처리한다. 이 콜백은 DOM이 바뀐 직후, 크롬이 화면에 칠하기 전에 돈다. 그래서 이미 차단된 작성자의 댓글은 한 번도 원래 모습으로 보이지 않는다.
   - 전체 스캔은 150ms에 한 번으로 묶는다. 새로 붙은 댓글은 위에서 바로 처리하므로 이 스캔은 안전망이다. 실측에서 간격은 비용을 바꾸지 않았다 ([decisions.md](decisions.md) "스캔 스케줄링 실측").
   - 우리 요소(메뉴 버튼, 가림막, 메뉴와 패널의 Shadow DOM 호스트)를 넣거나 뺀 것뿐이거나 그 안에서 일어난 변경이면 스캔을 걸지 않는다. 스캔이 버튼과 가림막을 넣는 것도 DOM 변경이라, 거르지 않으면 스캔이 스캔을 부른다.
2. `watchBlocked()`. 팝업, 패널, 메뉴 어디서 차단 목록을 바꾸든 즉시 다시 스캔한다. 사용자가 누른 변경이라 애니메이션을 켠다.
3. `watchSettings()`. 표시 방법이 바뀌었을 수 있으니 다시 스캔한다.
4. 만료 타이머. 가장 먼저 풀리는 임시 차단 시각에 맞춰 다시 스캔한다. 스캔은 DOM이 바뀔 때만 돌아서, 타이머가 없으면 기간이 끝나도 화면이 바뀔 때까지 가려져 있다. `setTimeout`의 최대 지연(약 24.8일)을 넘는 기간은 그만큼씩 끊어서 다시 건다.

`applyAll()`은 먼저 페이지 세계에 채널 ID를 적어 달라고 요청한다. 그다음 모든 댓글 요소를 돌면서 `applyOne()`을 부른다. `applyOne()`은 작성자를 읽어 `findBlock()`에 넘기고, 걸린 항목이 영구냐 임시냐에 따라 설정에서 표시 방법을 골라 `applyDisplay()`에 넘기고, 메뉴 버튼이 없으면 붙인다. 읽은 값과 결과는 줄 목록으로 모아 패널에 넘긴다.

### 표시 방법: `youtube.content/display.ts`

`applyDisplay(comment, display, options)` 하나가 댓글의 표시 상태를 맞춘다. 속성만 붙이고, 모양은 전부 `style.css`에 있다.

| 표시 방법 | 속성 | 붙는 곳 |
|---|---|---|
| `hide` | `data-cleantube-blocked="<항목 키>"` | 답글이면 그 답글, 최상위 댓글이면 스레드 전체 |
| `blur` | `data-cleantube-cover="blur"` | 그 댓글. `coverReplies`가 켜져 있고 최상위 댓글이면 스레드 전체 |
| `placeholder` | `data-cleantube-cover="placeholder"` | 위와 같음 |

- `hide`가 스레드째인 이유. 답글 묶음(`ytd-comment-replies-renderer`, "답글 N개" 버튼 포함)이 댓글 요소의 자식이 아니라 형제여서, 댓글만 숨기면 부모 없는 답글 묶음이 남는다. `blur`와 `placeholder`는 부모가 자리에 남으니 그 댓글만 가려도 된다.
- 스레드의 상태는 그 스레드의 최상위 댓글만 정한다. 답글은 스레드를 건드리지 않는다.
- 가림막. `blur`나 `placeholder`로 가린 요소의 첫 자식으로 `data-cleantube-overlay` 요소를 넣는다. "차단된 댓글" 글자와 "숨긴 항목 보기" pill이 들어 있다. `blur`에서는 댓글 위를 덮고 마우스를 올리면 pill만 보인다. `placeholder`에서는 내용 대신 그 한 줄이 보인다.
- "숨긴 항목 보기"를 누르면 그 요소에 `data-cleantube-revealed`가 붙어 가림이 풀리고 pill이 "다시 가리기"로 바뀐다. 요소에만 적어 두므로 다시 스캔해도 유지되고 페이지를 옮기면 사라진다.
- 가림을 풀 때는 속성과 가림막을 같이 치운다.
- 애니메이션. 사용자가 차단이나 해제를 눌렀을 때만 220ms 동안 움직인다. 스크롤로 새로 붙은 댓글은 바로 적용된다. Web Animations API를 쓰고, 끝 값은 CSS가 정한 것을 읽는다. 가릴 때는 ease-in, 풀 때는 ease-out.
  - `hide`: 높이·여백·투명도를 접거나 펼친다. 접힐 때는 끝난 뒤에 속성을 붙인다. 도중에 상태가 또 바뀌면 최신 요청을 기억했다가 끝난 뒤 그대로 맞춘다.
  - `blur`, `placeholder`, "숨긴 항목 보기": 속성을 바꾸기 전후로 요소의 높이와, 자식(내용과 가림막)의 자리·투명도·블러를 재서 달라진 것만 그 사이로 움직인다. 자리가 바뀐 것은 transform으로 원래 자리에서 새 자리로 옮겨 가고, 새로 보이는 것과 모양이 통째로 바뀌는 가림막은 투명한 데서 나타난다. 그래서 흐리게는 블러가 번지고, 자리표시자는 높이가 줄며 가림막이 나타나고, "숨긴 항목 보기"를 누르면 맨 윗줄에 가림막이 나타나며 내용이 밀려 내려온다. 상태 사이의 어떤 전환도 같은 코드로 된다. 속성은 바로 바뀌어 있으므로 끝나면 CSS 값이 그대로 이어진다. 도중에 또 바뀌면 지금 보이는 값에서 새로 시작한다.
  - 순서. 접힐 때는 가려진 모습 그대로 접히게 숨김을 먼저 맞추고, 펼칠 때는 펼친 끝 크기에 가림막이 들어가 있게 가림을 먼저 맞춘다. 숨겨진 요소의 가림은 보이지 않으니 움직이지 않는다.

### 댓글 메뉴: `youtube.content/menu.ts`

댓글마다 버튼 하나, 드롭다운은 페이지에 하나.

- 버튼은 댓글 오른쪽의 `#body > #action-menu`(유튜브가 ⋮를 두는 자리)에 넣는다. 유튜브 요소 안이라 모양은 페이지 CSS인 `style.css`에 있고, 댓글에 마우스를 올렸을 때만 보인다.
- 유튜브 ⋮의 왼쪽에 나란히 놓는다. 이 자리는 원래 `display:block`이라 그냥 넣으면 ⋮ 아래로 쌓여서, 우리 버튼이 들어 있을 때만 `display:flex`로 바꾼다.
- 버튼 색은 직접 정한다. 이 자리에서 상속받는 글자색은 테마와 상관없이 검정이라 어두운 테마에서 안 보인다. `html[dark]`이면 밝은 색.
- 드롭다운은 `<cleantube-menu>`의 Shadow DOM 안에 그린다. 버튼 아래에 오른쪽 정렬로 열리고, 메뉴 밖 클릭·Esc·스크롤·페이지 이동이면 닫힌다. 유튜브의 `<html dark>`를 읽어 테마를 맞춘다.
- 항목은 `index.ts`에서 `{ label, run(author, comment) }` 목록으로 넘긴다. `label`은 글자이거나 글자를 돌려주는 함수다. 함수면 메뉴를 열 때마다 다시 읽는다. `comment`는 메뉴를 연 그 댓글 요소다.
- 지금 항목은 둘이다. "영구 차단"과 "임시 차단 · 7일". 임시 차단의 기간은 메뉴에서 고르지 않고 팝업 설정(`temporaryDurationMs`)에서 정한다. 얼마 동안인지 누르기 전에 알 수 있게 항목 글자에 적는다.
- 유튜브의 ⋮ 메뉴는 건드리지 않는다. 이유는 decisions.md.

### 차단한 경위: `youtube.content/source.ts`

메뉴나 패널에서 차단하면 `readSource(comment)`가 그 댓글에서 세 가지를 읽어 항목의 `source`에 넣는다. 나중에 목록에서 왜 차단했는지 떠올릴 수 있게 하려는 것이다.

| 값 | 어디서 | 비고 |
|---|---|---|
| `url` | 댓글의 작성 시각("6년 전")에 걸린 링크 `#published-time-text a` | `/watch?v=<영상>&lc=<댓글>`. 열면 그 댓글이 맨 위에 강조돼 나온다. 답글은 `lc`가 `부모.답글` 꼴이다. 유튜브 주소가 아니면 남기지 않는다 |
| `videoTitle` | `ytd-watch-metadata #title yt-formatted-string` | 못 찾으면 `document.title`에서 " - YouTube"를 뗀 것. 150자에서 자른다 |
| `text` | 댓글 본문 `#content-text` | 유튜브는 이모지를 `<img alt="😭">`로 그려서 `textContent`만 읽으면 빠진다. 그림의 `alt`를 같이 읽는다. 300자에서 자른다 |

차단한 시각은 `at`에 따로 넣는다. 팝업에서 손으로 넣은 항목은 `at`만 있고 `source`는 없다.

### 디버그 패널: `youtube.content/panel.ts`

`settings.debugPanel`이 켜져 있으면 WXT `createShadowRootUi`로 `<cleantube-panel>` 호스트를 `body`에 붙이고 그 Shadow DOM 안에 패널을 그린다. 화면 오른쪽 위에 고정. 줄마다 댓글 하나: 핸들, 채널 ID, 걸린 차단 항목(영구인지 언제까지인지, 어느 키로 걸렸는지), 차단/해제 버튼. 접을 수 있다.

- 패널의 차단은 영구 차단이다. 임시 차단은 댓글 메뉴에서 한다. 해제는 걸린 항목을 목록에서 뺀다. 둘 다 storage에 쓰기만 하고, 화면 갱신은 `watchBlocked()` 경로가 한다.
- 스캔 결과가 이전과 같으면 다시 그리지 않는다.
- Shadow DOM 안의 변경은 `MutationObserver`에 잡히지 않으므로 패널을 그려도 스캔이 다시 돌지 않는다.
- `style.css`는 페이지에 적용돼야 해서 `cssInjectionMode: 'ui'`를 쓸 수 없다. 그래서 `panel.css`를 `?inline`으로 문자열로 가져와 `css` 옵션으로 넘긴다.
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
| `ytd-comment-thread-renderer` | `youtube.content/display.ts` | 최상위 댓글 하나와 그 답글 묶음을 감싸는 요소 |
| `ytd-comment-replies-renderer` | `youtube.content/display.ts` | 스레드 안의 답글 묶음. 이 안의 댓글은 답글 |
| `#body > #action-menu` | `youtube.content/menu.ts` | 댓글 오른쪽, 유튜브가 ⋮ 메뉴를 두는 자리. 로그아웃이면 유튜브 버튼은 `hidden`이고 자리만 있다 |
| `#published-time-text a` | `youtube.content/source.ts` | 댓글 헤더의 작성 시각에 걸린 링크. 그 댓글의 고유 주소 |
| `#content-text` | `youtube.content/source.ts` | 댓글 본문 |
| `ytd-watch-metadata #title yt-formatted-string` | `youtube.content/source.ts` | 영상 페이지에서 플레이어 아래의 영상 제목 |
| `html[dark]` | `style.css`, `youtube.content/menu.ts` | 유튜브가 어두운 테마를 표시하는 속성 |
| `commentEntity.author.channelId` | `youtube-main.content.ts` | 유튜브가 댓글 요소에 달아 두는 데이터. 셀렉터가 아니라 JS 프로퍼티 |

유튜브 요소 안에 우리가 넣는 것은 둘이다. 댓글 메뉴 버튼(`data-cleantube-trigger`)과 가림막(`data-cleantube-overlay`). 유튜브의 요소는 지우지 않는다.

## 매칭

`utils/matcher.ts`. DOM, storage, WXT를 import하지 않는다. 현재 시각도 인자로 받는다. 단위 테스트는 `tests/matcher.test.ts`, `npm test`로 돌린다.

- `findBlock(author, entries, now)` `author`를 차단하는 항목을, 없으면 null을 돌려준다.
  - 양쪽 다 채널 ID가 있으면 채널 ID만 본다. 대소문자가 다르면 다른 채널이다. 핸들까지 보면, 차단한 사람이 버린 핸들을 나중에 가져간 다른 사람이 걸린다.
  - 한쪽이라도 채널 ID가 없으면 핸들로 본다. trim, 소문자, 앞의 `@` 제거로 정규화한 뒤 정확히 일치. 유튜브 구조가 바뀌어 채널 ID를 못 읽게 돼도 차단이 유지된다.
  - 만료된 임시 차단은 건너뛴다. 영구와 임시가 둘 다 걸리면 영구를 돌려준다.
- `parseEntry(text)` 손으로 입력한 글자를 항목으로. `UC` + 22자 모양이면 채널 ID, 아니면 핸들.
- `entryKey(entry)` 같은 대상을 가리키는 항목인지 가리는 키. 목록에서 중복을 막고, 속성 값으로도 쓴다.
- `isExpired(entry, now)`.

## UI

- `hooks/useSettings.ts` `loadSettings()`로 초기값을 읽고 `watchSettings()`로 구독한다. `update(patch)`는 `updateSettings()`를 부르고 그 결과로 바로 그린다.
- `hooks/useBlocked.ts` `loadBlocked()`로 읽고 `watchBlocked()`로 구독한다. 쓰기는 `blocklist.ts`의 `addBlock`/`removeBlock`을 그대로 내보낸다.
- `entrypoints/popup/App.tsx` 차단 목록, 영구 차단 설정(표시 방법), 임시 차단 설정(기간, 표시 방법), 답글도 함께 가리기, 디버그 패널 토글. 기간은 1일·7일·30일 또는 직접 입력(숫자 + 시간/일)이고 ms 하나로 저장한다.
- `utils/duration.ts` `HOUR_MS`, `DAY_MS`, `formatDuration(ms)`. 팝업과 댓글 메뉴가 같은 표기("7일", "3시간")를 쓰게 한다.
- `components/BlockList.tsx` 차단 목록 보기와 편집. 이름 자리에 핸들(없으면 채널 ID), 아래에 영구인지 언제까지인지. 손으로 넣는 항목은 영구 차단이다. 만료된 항목은 보여 주지 않는다. 스타일은 옆의 `BlockList.css`.
  - 항목마다 펼치기 버튼이 있다. 펼치면 차단한 때, 영상 제목, 댓글 내용, "이 댓글로 이동" 링크가 나온다. 한 번에 하나만 펼친다. `at`도 `source`도 없는 예전 항목에는 버튼이 없다.
  - 링크는 저장된 주소가 유튜브의 https 주소일 때만 만든다. 저장소에 있는 값을 그대로 믿지 않는다.
- `assets/base.css` 팝업 기본 스타일. 색, 글꼴, 버튼, 입력창.
