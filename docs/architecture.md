# 구조

WXT가 `entrypoints/` 폴더를 읽어 manifest를 만든다. `wxt.config.ts`에는 파일 구조로 알 수 없는 것(이름, 설명, 권한)만 적는다.

WXT의 auto-import는 꺼 두었다(`imports: false`). 켜 두면 `utils/`, `hooks/`, `components/`의 export가 import 없이 전역으로 보여서, storage 항목처럼 모듈 안에 둔 것을 밖에서 쓸 수 있게 된다. WXT API는 `#imports`에서 명시적으로 import한다.

## 큰 그림

```
popup (React)    options (React)     댓글 메뉴, 디버그 패널 (유튜브 화면 안, Shadow DOM)
    |  설정          |  차단 목록         |  영구 차단 / 임시 차단 / 해제, 차단/해제 버튼
    v                v                   v
chrome.storage.local "local:blocked"   차단 목록 (BlockEntry[])        <-- background.ts가 다른 PC와 맞춤
                     "local:blockedRemoved"  뺀 항목과 뺀 시각                 sync "blocked.00"~"blocked.31"
chrome.storage.sync  "sync:settings"   설정 (차단 기능 켜기/끄기, 임시 차단 기간, 표시 방법, 디버그 패널)  <-- background.ts가 꺼짐 배지
    |  watchBlocked(), watchSettings()   팝업, 차단 목록 페이지, 콘텐츠 스크립트가 각자 구독
    v
entrypoints/youtube.content/index.ts              (격리 세계)
    |  MutationObserver  ->  새로 붙은 댓글은 즉시, 전체는 150ms로 묶어 applyAll()
    |  임시 차단이 풀리는 시각에 타이머  ->  applyAll()
    |
    |  1. document에 cleantube:channel-id-request 이벤트
    |       -> entrypoints/youtube-main.content.ts  (페이지 세계)
    |          댓글 요소에 data-cleantube-channel-id="UC…" 속성
    |  2. 댓글마다 핸들과 채널 ID를 읽어 차단 목록과 비교 (만료된 임시 차단은 건너뜀)
    |  3. 걸린 항목이 영구냐 임시냐에 따라 설정에서 표시 방법을 고름 (차단 기능을 꺼 두면 가리지 않음)
    |  4. 댓글에 메뉴 버튼 붙이기 (꺼 두면 떼기), 읽은 값과 결과를 디버그 패널에 그림 (패널이 켜져 있을 때)
    v
표시 방법에 따라 속성을 붙이고 style.css가 처리
  완전히 숨기기       data-cleantube-blocked="<항목 키>"   (답글은 그 답글, 최상위 댓글은 스레드 전체)
  흐리게              data-cleantube-cover="blur"          + "숨긴 항목 보기" 가림막
  문구로 바꾸기       data-cleantube-cover="placeholder"   + "차단된 댓글"과 "숨긴 항목 보기" 가림막
```

팝업, 차단 목록 페이지, 메뉴, 패널, 콘텐츠 스크립트가 storage 항목을 공유하고, 서로 메시지를 주고받지 않는다. 메뉴와 패널의 버튼도 storage에 쓰기만 하고, 그 변경을 콘텐츠 스크립트가 구독으로 받아 화면을 갱신한다. 백그라운드 스크립트는 처음 설치할 때 첫 사용 안내 탭을 여는 것, 차단 목록을 다른 PC와 맞추는 것, 차단 기능이 꺼져 있으면 툴바 아이콘에 배지를 붙이는 것만 한다. 다른 곳은 백그라운드가 있는지 모른다. 백그라운드가 맞춰 넣은 것도 `local:blocked`의 변경으로 똑같이 받는다.

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
| `popup/` | action.default_popup | 차단 기능 스위치, 차단한 수와 차단 목록 페이지를 여는 버튼, 영구/임시 차단 설정, 답글 범위와 디버그 패널 스위치 |
| `options/` | options_ui (`open_in_tab`) | 설정 페이지. 차단 목록(보기와 편집)과 언어 두 탭. 브라우저 탭 하나로 열린다 |
| `onboarding/` | (manifest에 없음, `onboarding.html`) | 첫 사용 안내. 처음 설치하면 백그라운드가 탭으로 연다 |
| `background.ts` | background (`service_worker`) | 처음 설치하면(`runtime.onInstalled`, `reason === 'install'`) 첫 사용 안내 탭을 연다. 차단 목록을 다른 PC와 맞춘다. 아래 "차단 목록 동기화". 차단 기능이 꺼져 있으면 툴바 아이콘에 배지를 붙인다. 아래 "꺼짐 배지" |

## 저장

두 곳에 나눠 둔다.

### 차단 목록: `utils/blocklist.ts`, `local:blocked`

`BlockEntry[]`. `chrome.storage.local`에 둔다. `sync`는 키 하나가 8KB라 목록을 통째로 넣지 못하고, 차단한 경위는 이 브라우저 밖으로 내보내지 않기로 했다. 그래서 이쪽이 원본이고, 다른 PC와는 백그라운드가 `sync`에 나눠 담아 맞춘다(아래 "차단 목록 동기화").

| 필드 | 타입 | 의미 |
|---|---|---|
| `channelId` | string? | 메뉴나 패널에서 차단하면 들어간다. 있으면 이것으로 매칭한다 |
| `handle` | string? | 손으로 입력한 항목은 이것만 있다. `channelId`가 있을 때는 목록에 보여 줄 이름이기도 하다 |
| `until` | number? | 임시 차단이 풀리는 시각(epoch ms). 없으면 영구 차단 |
| `at` | number? | 차단한 시각(epoch ms). 이 필드가 생기기 전에 만든 항목에는 없다 |
| `source` | `{ url, videoTitle?, text? }`? | 어느 댓글을 보고 차단했는지. 댓글 메뉴나 패널에서 차단했을 때만 있다. 매칭에는 쓰지 않는다 |

- `loadBlocked()` 전체를 읽는다. `watchBlocked(callback)` 변경을 구독한다. 돌려주는 함수로 구독을 푼다.
- 쓰기는 기준이 둘이다.
  - 항목 기준. `addBlock(entry)`는 키가 같은 기존 항목을 새 항목으로 바꾸고, `removeBlock(entry)`는 키가 같은 항목을 뺀다. 차단 목록 페이지와 패널의 해제처럼 항목 하나를 골라서 다룰 때 쓴다.
  - 작성자 기준. `blockAuthor(author, entry)`는 그 작성자에게 걸린 항목을 모두 빼고 `entry` 하나를 넣는다. `unblockAuthor(author)`는 모두 빼기만 한다. 유튜브 화면에서 댓글을 보고 차단하거나 풀 때 쓴다.
  - 작성자 기준이 따로 있는 이유. 같은 사람이 키가 다른 항목 여럿에 걸려 있을 수 있다. 차단 목록 페이지에서 손으로 넣은 핸들 항목은 키가 핸들이고, 메뉴로 넣은 항목은 키가 채널 ID다. 키가 같은 것만 바꾸면 영구를 임시로 바꿔도 남은 영구 항목이 이긴다. 빼기와 넣기는 한 번의 쓰기라서 그 사이에 풀린 상태가 화면에 나오지 않는다.
- 넷 다 쓰기 전에 최신 값을 다시 읽고, 기간이 끝난 지 30일이 넘은 임시 차단(`canForget`)을 같이 치운다.
- 만료는 지우는 게 아니라 무시하는 것이다. 매칭, 팝업의 수, 차단 목록이 만료된 항목을 건너뛴다. 끝난 항목은 30일 동안 목록에 남는다. 이유는 아래 "차단 목록 동기화"의 `canForget`.
- 넷 다 뺀 항목의 키와 뺀 시각을 `local:blockedRemoved`(`Record<키, epoch ms>`)에 남기고, 다시 넣은 항목은 그 기록을 지운다. 목록과 기록은 한 번에 쓴다. 다른 PC가 아직 그 항목을 들고 있다가 되살리지 않게 하려는 것이다. 기간이 끝난 임시 차단은 적지 않는다. 남아 있는 그 항목이 같은 일을 한다.

### 차단 목록 동기화: `entrypoints/background.ts`, `utils/blocksync.ts`

차단 목록을 같은 크롬 계정의 다른 PC와 맞춘다. 크롬 동기화가 꺼져 있으면 `sync`가 이 PC에만 있는 저장소처럼 동작해서 지금과 같다. 켜고 끄는 설정은 없다.

```
유튜브 탭, 팝업, 차단 목록 페이지
    |  addBlock / removeBlock / blockAuthor / unblockAuthor  (local만 쓴다)
    v
local:blocked + local:blockedRemoved  <──── 합친 결과를 씀 ───┐
    |  storage.onChanged                                       |
    v                                                          |
background.ts  ->  syncBlocked()  (한 번에 하나씩)             |
    1. sync의 blocked.00~31을 읽어 unpackBuckets()             |
    2. mergeStates(local, sync)  ───────────────────────────────┘ 바뀌었을 때만
    3. packState()  ->  달라진 sync 키만 지우고 씀
    4. local:blockSyncStatus에 사용량과 담지 못한 수
    ^
    |  storage.onChanged (다른 PC가 sync를 바꿈)
chrome.storage.sync blocked.00 ~ blocked.31
```

- sync를 쓰는 곳은 백그라운드 하나다. 탭마다 쓰면 sync의 쓰기 한도(분당 120회)에 걸리고 서로 덮어쓴다.
- 백그라운드는 서비스 워커라 할 일이 없으면 꺼지고, storage 변경 알림이 오면 다시 켜진다. 켜질 때마다 한 번 맞춘다. 도는 동안 알림이 더 오면 끝난 뒤 한 번만 더 돈다.
- 자기가 쓴 것도 변경 알림을 부르지만, 다음 번에는 바뀐 게 없어서 아무것도 쓰지 않고 끝난다. `local:blockSyncStatus`만 바뀐 것에는 반응하지 않는다.

`utils/blocksync.ts`는 순수 함수다. `matcher.ts`처럼 DOM, storage, WXT를 import하지 않고 현재 시각을 인자로 받는다. 테스트는 `tests/blocksync.test.ts`.

- `mergeStates(local, remote, now)` 항목마다 더 나중에 한 쪽이 이긴다. 차단은 `at`, 빼기는 뺀 시각으로 비교하고, 같으면 빼기가 이긴다. `at`이 없는 예전 항목은 0으로 친다.
  - 같은 사람의 차단이 양쪽에 있고 시각이 같으면 이 PC의 것을 쓴다(경위가 붙어 있다). 다른 PC가 나중에 다시 차단했으면 그것을 쓰되 이 PC의 경위는 옮겨 붙인다.
  - 30일(`REMOVED_TTL_MS`, 임시값)보다 오래된 빼기 기록과, 기간이 끝난 지 30일이 넘은 임시 차단(`canForget(entry, now)`)은 버린다. 그보다 오래 꺼져 있던 PC는 뺀 항목이나 옛 차단을 되살릴 수 있다.
  - 기간이 끝난 임시 차단을 바로 버리지 않는 이유. 영구 차단을 임시로 바꾸면 같은 키의 항목이 바뀔 뿐 빼기 기록이 남지 않는다. 끝나자마자 버리면, 그동안 꺼져 있던 PC가 들고 온 옛 영구 차단을 막을 것이 없어 모든 PC에 되살아난다. 남겨 두면 더 나중에 한 그 항목이 이긴다. 남아 있는 동안 sync의 자리도 쓴다.
  - sync에서 항목이 사라진 것은 빼기가 아니다. 빼기는 빼기 기록으로만 전한다. 그래서 공간이 모자라 sync에서 밀려난 항목도 이미 받은 PC에는 남는다.
  - 바뀐 게 없으면 local의 객체와 순서를 그대로 돌려준다. `sameState()`로 쓸 필요가 있는지 가린다.
- `packState(state)` sync에 담을 모양. 32개 키(`blocked.00`~`blocked.31`)에 항목의 키를 해시(FNV-1a)해 나눠 담는다. 항목 하나를 바꾸면 sync 키 하나만 다시 쓴다.
  - 모양은 `{ e: [[채널 ID, 핸들, at, until?], …], r: [[키, 뺀 시각], …] }`. 필드 이름 없이 배열로 줄인다. 경위는 담지 않는다.
  - 빼기 기록을 먼저 담고, 차단은 최근에 차단한 것부터 담는다. 공간이 모자라면 그보다 오래된 차단은 담지 않는다(사용자가 정함). 한 번 모자라면 그 뒤는 작은 항목이라도 담지 않는다.
  - 같은 상태면 어느 PC에서 만들어도 같은 결과가 나와야 한다. 다르면 두 PC가 서로 덮어쓰기를 되풀이한다. 그래서 저장된 순서가 아니라 시각과 키로 정렬한다.
  - 한도는 sync 전체 102,400바이트에서 설정 몫 2KB를 뺀 것(`SYNC_BUDGET_BYTES`, 임시값)과 키 하나 8,192바이트. 크롬은 int32를 넘는 수를 `1.794501596429e+12`처럼 지수로 적어서 센다(실측). 그대로 `JSON.stringify` 길이로 세면 한도를 넘겨 쓰기가 통째로 실패한다.
  - 경위 없이 영구 차단 약 1,500~1,750명, 임시 차단 약 1,300명이 들어간다(핸들 길이에 따라).
- `unpackBuckets(values)` sync에서 읽은 값을 상태로. 다른 PC나 예전 버전이 쓴 값이라 모양이 맞지 않는 것은 버린다.
- `syncWarning(status)` 안내. 담지 못한 항목이 있으면 그 수, 없고 90%(임시값) 이상 차면 사용률. 팝업과 차단 목록 페이지가 `hooks/useSyncWarning.ts`로 읽어 띄운다.

### 설정: `utils/settings.ts`, `sync:settings`

| 필드 | 타입 | 의미 |
|---|---|---|
| `enabled` | boolean | 차단 기능 전체. 기본 켜짐. 끄면 유튜브 화면에서 아무것도 가리지 않고 댓글 메뉴 버튼도 떼며, 툴바 아이콘에 배지가 붙는다. 차단 목록은 그대로다 |
| `temporaryDurationMs` | number | 댓글 메뉴의 "임시 차단"이 차단하는 기간(ms). 기본 7일. 바꿔도 이미 걸어 둔 임시 차단은 그대로다 |
| `display.permanent` | `'hide' \| 'blur' \| 'placeholder'` | 영구 차단된 댓글의 표시 방법. 기본 `hide` |
| `display.temporary` | 같음 | 임시 차단된 댓글의 표시 방법. 기본 `blur` |
| `coverReplies` | boolean | `blur`나 `placeholder`일 때 최상위 댓글의 답글까지 가릴지. 기본 꺼짐. `hide`는 이 값과 상관없이 스레드째 숨긴다 |
| `debugPanel` | boolean | 유튜브 화면 오른쪽에 디버그 패널을 띄울지. 기본 꺼짐 |
| `language` | `'auto' \| 'en' \| 'ko' \| 'ja' \| 'zh-CN' \| 'zh-TW'` | 화면 언어. 기본 `auto`(브라우저 언어를 따름). 아래 "언어" |

`sync:`는 `chrome.storage.sync`라 같은 크롬 계정의 다른 기기와 동기화된다.

- `loadSettings()` 전체를 읽는다. `watchSettings(callback)` 변경을 구독한다.
- `updateSettings(patch)` 최신 값을 다시 읽어 병합한 뒤 저장하고, 병합한 결과를 돌려준다. 다른 창에서 바꾼 값을 덮어쓰지 않기 위해서다. `display`는 한쪽만 넘겨도 된다(`SettingsPatch`). 저장된 값 그대로에 병합한다. 아래처럼 고쳐 읽은 값에 병합하면 더 새 버전이 적어 둔 값을 기본값으로 바꿔 쓴다.

저장된 값은 그대로 믿지 않고 읽을 때마다 고쳐 읽는다(`withDefaults`). 동기화되는 값이라 다른 버전이 쓴 것일 수 있다.

- `fallback`은 값이 통째로 없을 때만 쓰인다. 전에 저장된 객체에는 나중에 추가한 필드가 빠져 있으므로 `DEFAULT_SETTINGS` 위에 덮어 쓴다.
- 이 버전이 모르는 `language`(`isLanguageSetting`)나 표시 방법은 기본값으로 읽는다. 더 새 버전을 쓰는 다른 PC가 보낼 수 있고, 그대로 쓰면 그 언어의 글을 못 찾아 팝업, 설정 페이지, 유튜브 화면의 스크립트가 죽는다.

`enabled`도 `sync:settings` 안이라 한 PC에서 끄면 같은 계정의 다른 PC도 꺼진다.

### 꺼짐 배지: `entrypoints/background.ts`

차단 기능(`enabled`)이 꺼져 있으면 툴바 아이콘에 배지를 붙인다. 꺼 둔 것을 잊으면 확장이 고장 난 것처럼 보여서다.

- 백그라운드가 켜질 때 `loadSettings()`로 한 번 맞추고, `watchSettings()`로 구독해 바뀔 때마다 맞춘다. 켜져 있으면 배지 글을 비운다.
- 배지 글은 화면 언어를 따른다(`locales/`의 `badge.off`, "꺼짐", "Off"). 언어를 바꿔도 다시 맞춘다. 배지에는 네 글자쯤만 들어간다.
- 색은 회색 바탕(`#5c5c5c`, `base.css`의 밝은 테마 `--muted`와 같은 값)에 흰 글자. 배지는 CSS 변수를 못 쓴다.
- `runtime.onStartup`에 빈 리스너를 단다. 브라우저를 켤 때도 워커가 돌아 배지를 맞추게 하려는 것이다. 배지가 브라우저를 다시 켠 뒤에도 남는지는 확인하지 못했다(헤드리스 확인에서 CDP로 올린 확장이 재시작 뒤 남지 않았다).

### 언어: `utils/i18n.ts`, `locales/`

화면의 글은 전부 `locales/`의 언어 파일에 있다. `en.ts`가 기준이고 `ko.ts`, `ja.ts`, `zh-CN.ts`, `zh-TW.ts`는 `satisfies Messages`로 같은 모양을 지킨다(빠진 문구는 타입 검사가, 빈 문구는 `tests/i18n.test.ts`가 잡는다). 숫자가 들어가는 문구는 함수다. 언어마다 복수형과 어순이 달라서.

- `resolveLocale(setting, uiLanguage)` 설정이 `auto`면 브라우저 언어의 앞부분(`ko`, `ja`, `zh`)으로 고르고, 없는 언어는 영어. 중국어는 대만·홍콩·마카오와 `zh-Hant`면 번체(`zh-TW`), 나머지는 간체(`zh-CN`). 브라우저 API를 쓰지 않는 순수 함수라 브라우저 언어(`browser.i18n.getUILanguage()`)는 부르는 쪽이 넘긴다.
- `messagesFor(locale)` 그 언어의 문구 객체(`t`).
- 브라우저의 `chrome.i18n`은 늘 브라우저 언어를 따라 고른 언어로 바꿀 수 없어서 쓰지 않는다. manifest의 이름과 설명만 `public/_locales`(`__MSG_extName__`, `__MSG_extDescription__`, 기본 영어)에 있다. manifest가 그것만 읽을 수 있다.
- 확장 페이지(팝업, 설정, 첫 사용 안내)는 맨 바깥의 `I18nProvider`(`hooks/useI18n.tsx`)가 설정을 구독해 `useI18n()`으로 `{ locale, t, setting, browserLocale }`을 준다. 설정을 읽기 전에는 아무것도 그리지 않는다(브라우저 언어로 그렸다가 바뀌며 깜박이지 않게). `<html lang>`도 맞춘다.
- 콘텐츠 스크립트는 `index.ts`가 `locale`과 `t`를 들고 `watchSettings()`에서 다시 고른다. 메뉴·가림막·패널에는 글과 `lang`을 넘긴다. 언어를 바꾸면 열려 있는 유튜브 탭도 다시 불러오지 않고 바뀐다(이미 붙은 가림막의 글과 메뉴 버튼 이름까지).
- 날짜는 `toLocaleString(locale)`, 이름순 정렬은 `localeCompare(…, locale)`로 화면 언어를 따른다.
- 글꼴. 한글·가나·한자는 언어마다 글꼴 이름을 적은 목록을 쓴다. 확장 페이지는 `base.css`의 `--cjk`(`:lang()`으로 바뀜), 유튜브 화면은 `style.css`가 페이지에 두는 `--cleantube-cjk-*`이고 메뉴·패널의 Shadow DOM으로도 물려받는다. 이유는 [decisions.md](decisions.md) "다국어".

## 콘텐츠 스크립트

두 개가 서로 다른 세계에서 돈다. 격리 세계는 확장기능 API를 쓸 수 있지만 페이지의 JS 객체가 보이지 않는다. 페이지 세계는 그 반대다. DOM은 둘이 같이 본다.

### 격리 세계: `youtube.content/index.ts`

시작하면 설정과 차단 목록을 읽고 `applyAll()`을 한 번 돌린 뒤 네 가지에 반응한다.

1. `MutationObserver`가 `document.documentElement`의 자식 변경 전체를 감시한다. 댓글은 스크롤해야 뒤늦게 붙고, 유튜브는 SPA라 페이지를 옮겨도 스크립트가 다시 실행되지 않기 때문이다. 콜백은 두 가지를 한다.
   - 새로 붙은 댓글은 그 자리에서 바로 처리한다. 이 콜백은 DOM이 바뀐 직후, 크롬이 화면에 칠하기 전에 돈다. 그래서 이미 차단된 작성자의 댓글은 한 번도 원래 모습으로 보이지 않는다.
   - 전체 스캔은 150ms에 한 번으로 묶는다. 새로 붙은 댓글은 위에서 바로 처리하므로 이 스캔은 안전망이다. 실측에서 간격은 비용을 바꾸지 않았다 ([decisions.md](decisions.md) "스캔 스케줄링 실측").
   - 우리 요소(메뉴 버튼, 가림막, 메뉴와 패널의 Shadow DOM 호스트)를 넣거나 뺀 것뿐이거나 그 안에서 일어난 변경이면 스캔을 걸지 않는다. 스캔이 버튼과 가림막을 넣는 것도 DOM 변경이라, 거르지 않으면 스캔이 스캔을 부른다.
2. `watchBlocked()`. 차단 목록 페이지, 패널, 메뉴 어디서 차단 목록을 바꾸든 즉시 다시 스캔한다. 사용자가 누른 변경이라 애니메이션을 켠다.
3. `watchSettings()`. 차단 기능을 켜고 껐거나 표시 방법이 바뀌었을 수 있으니 다시 스캔한다(사용자가 바꾼 것이라 애니메이션을 켠다). 언어도 다시 고르고, 바뀌었으면 패널을 다시 그린다.
4. 만료 타이머. 가장 먼저 풀리는 임시 차단 시각에 맞춰 다시 스캔한다. 스캔은 DOM이 바뀔 때만 돌아서, 타이머가 없으면 기간이 끝나도 화면이 바뀔 때까지 가려져 있다. `setTimeout`의 최대 지연(약 24.8일)을 넘는 기간은 그만큼씩 끊어서 다시 건다.

스캔과 만료의 타이머는 WXT의 `ctx.setTimeout`이 아니라 그냥 `setTimeout`으로 걸고 `ctx.onInvalidated` 한 곳에서 치운다. `ctx.setTimeout`은 부를 때마다 정리용 리스너를 하나씩 달고 떼지 않아서(WXT 0.21), 탭이 열려 있는 내내 걸리는 타이머에 쓰면 리스너가 쌓인다.

유튜브는 댓글 정렬을 바꾸면 댓글 요소를 그대로 두고 내용만 바꾼다(2026-11-15 실측, 다른 영상으로 옮길 때는 새 요소다). 이때는 새로 붙은 댓글이 없어서 150ms로 묶은 전체 스캔이 맞춘다. 그 사이 약 160ms 동안 앞 댓글의 가림이 남는다. [backlog.md](backlog.md)에 적어 두었다.

`applyAll()`은 먼저 페이지 세계에 채널 ID를 적어 달라고 요청한다. 그다음 모든 댓글 요소를 돌면서 `applyOne()`을 부른다. `applyOne()`은 작성자를 읽어 `findBlock()`에 넘기고, 걸린 항목이 영구냐 임시냐에 따라 설정에서 표시 방법을 골라 `applyDisplay()`에 넘기고, 메뉴 버튼이 없으면 붙인다. 읽은 값과 결과는 줄 목록으로 모아 패널에 넘긴다.

차단 기능(`enabled`)을 꺼 두면 `applyOne()`은 걸린 항목이 있어도 `applyDisplay()`에 null을 넘겨 가림을 풀고, 메뉴 버튼을 붙이는 대신 뗀다(`menu.detach()`). 스캔은 그대로 돌아서 꺼진 동안 새로 붙은 댓글에서도 떼고, 다시 켜면 다음 스캔에서 가리고 붙인다. 매칭도 그대로 해서 디버그 패널은 꺼져 있을 때도 어느 댓글이 걸리는지 보여 준다. 패널은 자기 설정(`debugPanel`)만 따르고, 차단/해제 버튼도 그대로 목록에 쓴다(화면은 다시 켤 때 바뀐다). "숨긴 항목 보기"로 열어 둔 것은 껐다 켜면 다시 가려진다. 끌 때 가림막과 함께 치우기 때문이다.

### 표시 방법: `youtube.content/display.ts`

`applyDisplay(comment, display, options)` 하나가 댓글의 표시 상태를 맞춘다. 속성만 붙이고, 모양은 전부 `style.css`에 있다. `options`의 `text`(가림막의 글)와 `lang`(화면 언어)은 부를 때마다 받아 모듈에 들고, 이미 있는 가림막도 다를 때만 글과 `lang`을 고친다.

| 표시 방법 | 속성 | 붙는 곳 |
|---|---|---|
| `hide` | `data-cleantube-blocked="<항목 키>"` | 답글이면 그 답글, 최상위 댓글이면 스레드 전체 |
| `blur` | `data-cleantube-cover="blur"` | 그 댓글. `coverReplies`가 켜져 있고 최상위 댓글이면 스레드 전체 |
| `placeholder` | `data-cleantube-cover="placeholder"` | 위와 같음 |

- `hide`가 스레드째인 이유. 답글 묶음(`ytd-comment-replies-renderer`, "답글 N개" 버튼 포함)이 댓글 요소의 자식이 아니라 형제여서, 댓글만 숨기면 부모 없는 답글 묶음이 남는다. `blur`와 `placeholder`는 부모가 자리에 남으니 그 댓글만 가려도 된다.
- 스레드의 상태는 그 스레드의 최상위 댓글만 정한다. 답글은 스레드를 건드리지 않는다.
- 가림막. `blur`나 `placeholder`로 가린 요소의 첫 자식으로 `data-cleantube-overlay` 요소를 넣는다. "차단된 댓글" 글자와 "숨긴 항목 보기" pill이 들어 있다. `blur`에서는 댓글 위를 덮고 마우스를 올리면 pill만 보인다. `placeholder`에서는 내용 대신 그 한 줄이 보인다.
- "숨긴 항목 보기"를 누르면 그 요소에 `data-cleantube-revealed`가 붙어 가림이 풀리고 pill이 "다시 가리기"로 바뀐다. 요소에만 적어 두므로 다시 스캔해도 유지되고 페이지를 옮기면 사라진다.
  - 가린 요소마다 그것을 가리게 한 차단 항목의 키를 기억한다(`coveredBy`). 유튜브가 정렬을 바꾸며 요소를 다른 댓글에 다시 쓰면 키가 달라지고, 그때 열어 둔 상태를 뗀다. 떼지 않으면 앞 댓글에서 열어 둔 것이 다른 사람의 차단된 댓글까지 열어 둔다(실측에서 그랬다).
- 가림을 풀 때는 속성과 가림막을 같이 치운다.
- 애니메이션. 사용자가 차단이나 해제를 눌렀을 때만 220ms 동안 움직인다. 스크롤로 새로 붙은 댓글은 바로 적용된다. Web Animations API를 쓰고, 끝 값은 CSS가 정한 것을 읽는다. 가릴 때는 ease-in, 풀 때는 ease-out. 운영체제의 "동작 줄이기"(`prefers-reduced-motion`)가 켜져 있으면 움직이지 않고 바로 바꾼다. "숨긴 항목 보기"와 첫 사용 안내의 예시도 같은 코드라 같이 따른다.
  - `hide`: 높이·여백·투명도를 접거나 펼친다. 접힐 때는 끝난 뒤에 속성을 붙인다. 도중에 상태가 또 바뀌면 최신 요청을 기억했다가 끝난 뒤 그대로 맞춘다.
  - `blur`, `placeholder`, "숨긴 항목 보기": 속성을 바꾸기 전후로 요소의 높이와, 자식(내용과 가림막)의 자리·투명도·블러를 재서 달라진 것만 그 사이로 움직인다. 자리가 바뀐 것은 transform으로 원래 자리에서 새 자리로 옮겨 가고, 새로 보이는 것과 모양이 통째로 바뀌는 가림막은 투명한 데서 나타난다. 그래서 흐리게는 블러가 번지고, 자리표시자는 높이가 줄며 가림막이 나타나고, "숨긴 항목 보기"를 누르면 맨 윗줄에 가림막이 나타나며 내용이 밀려 내려온다. 상태 사이의 어떤 전환도 같은 코드로 된다. 속성은 바로 바뀌어 있으므로 끝나면 CSS 값이 그대로 이어진다. 도중에 또 바뀌면 지금 보이는 값에서 새로 시작한다.
  - 순서. 접힐 때는 가려진 모습 그대로 접히게 숨김을 먼저 맞추고, 펼칠 때는 펼친 끝 크기에 가림막이 들어가 있게 가림을 먼저 맞춘다. 숨겨진 요소의 가림은 보이지 않으니 움직이지 않는다.

### 댓글 메뉴: `youtube.content/menu.ts`

댓글마다 버튼 하나, 드롭다운은 페이지에 하나.

- 버튼은 댓글 오른쪽의 `#body > #action-menu`(유튜브가 ⋮를 두는 자리)에 넣는다. 유튜브 요소 안이라 모양은 페이지 CSS인 `style.css`에 있고, 댓글에 마우스를 올렸을 때만 보인다.
- 유튜브 ⋮의 왼쪽에 나란히 놓는다. 이 자리는 원래 `display:block`이라 그냥 넣으면 ⋮ 아래로 쌓여서, 우리 버튼이 들어 있을 때만 `display:flex`로 바꾼다.
- 버튼 색은 직접 정한다. 이 자리에서 상속받는 글자색은 테마와 상관없이 검정이라 어두운 테마에서 안 보인다. `html[dark]`이면 밝은 색.
- 드롭다운은 `<cleantube-menu>`의 Shadow DOM 안에 그린다. 버튼 아래에 오른쪽 정렬로 열리고, 메뉴 밖 클릭·Esc·스크롤·페이지 이동이면 닫힌다. 유튜브의 `<html dark>`를 읽어 테마를 맞춘다.
- 항목은 `index.ts`의 `menuItems(author, comment)`가 `{ label, run }` 목록으로 돌려준다. 메뉴는 열 때마다 이 함수를 불러 그 댓글에 맞는 항목을 받는다. `comment`는 메뉴를 연 그 댓글 요소다.
- 항목은 둘이고 그 댓글의 차단 상태에 따라 달라진다. 걸려 있는 종류의 자리에 해제가 오고, 다른 종류의 항목은 그대로 남아서 누르면 그 종류로 바뀐다.
  - 차단 안 됨: "영구 차단", "임시 차단 · 7일"
  - 영구 차단: "영구 차단 해제", "임시 차단 · 7일"
  - 임시 차단: "영구 차단", "임시 차단 해제"
- 차단은 `blockAuthor()`, 해제는 `unblockAuthor()`로 쓴다. 그 작성자에게 걸린 항목을 모두 빼므로 누른 뒤의 상태가 항목 글자와 같다.
- 글자와 동작은 메뉴를 열 때 한 쌍으로 정해진다. 열려 있는 사이에 목록이나 설정이 바뀌어도 적힌 대로 동작한다.
- 임시 차단의 기간은 메뉴에서 고르지 않고 팝업 설정(`temporaryDurationMs`)에서 정한다. 얼마 동안인지 누르기 전에 알 수 있게 항목 글자에 적는다.
- 차단된 댓글의 메뉴는 그 댓글이 보여야 열 수 있다. 완전히 숨긴 댓글은 열 수 없어서 패널이나 차단 목록 페이지에서 푼다. 흐리게나 "차단된 댓글"로 바꾼 댓글은 "숨긴 항목 보기"를 누른 뒤에 연다.
- 차단 기능을 끄면 `detach(comment)`가 버튼을 뗀다. 그 버튼으로 메뉴가 열려 있었으면 닫는다.
- 유튜브의 ⋮ 메뉴는 건드리지 않는다. 이유는 decisions.md.

### 차단한 경위: `youtube.content/source.ts`

메뉴나 패널에서 차단하면 `readSource(comment)`가 그 댓글에서 세 가지를 읽어 항목의 `source`에 넣는다. 나중에 목록에서 왜 차단했는지 떠올릴 수 있게 하려는 것이다.

| 값 | 어디서 | 비고 |
|---|---|---|
| `url` | 댓글의 작성 시각("6년 전")에 걸린 링크 `#published-time-text a` | `/watch?v=<영상>&lc=<댓글>`. 열면 그 댓글이 맨 위에 강조돼 나온다. 답글은 `lc`가 `부모.답글` 꼴이다. 유튜브 주소가 아니면 남기지 않는다 |
| `videoTitle` | 그 댓글이 들어 있는 영상 페이지(`ytd-watch-flexy`)의 `ytd-watch-metadata #title yt-formatted-string` | 못 찾으면 `document.title`에서 " - YouTube"를 뗀 것. 150자에서 자른다. 문서 전체에서 찾지 않는다. 유튜브는 다른 화면으로 가도 보던 영상 페이지를 숨긴 채 남겨 둔다(2026-11-15 실측) |
| `text` | 댓글 본문 `#content-text` | 유튜브는 이모지를 `<img alt="😭">`로 그려서 `textContent`만 읽으면 빠진다. 그림의 `alt`를 같이 읽는다. 300자에서 자른다 |

차단한 시각은 `at`에 따로 넣는다. 차단 목록 페이지에서 손으로 넣은 항목은 `at`만 있고 `source`는 없다.

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
| `ytd-watch-flexy` | `youtube.content/source.ts` | 영상 페이지 전체를 감싸는 요소. 댓글도 이 안에 있다. 다른 화면으로 가면 `hidden`으로 남는다 |
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
- `matches(author, entry)` 항목 하나가 `author`에게 걸리는지. `findBlock()`이 쓰는 위의 규칙이고 만료는 따지지 않는다. `blocklist.ts`가 작성자에게 걸린 항목을 뺄 때 쓴다.
- `parseEntry(text)` 손으로 입력한 글자를 항목으로. `UC` + 22자 모양이면 채널 ID, 아니면 핸들. 채널 주소(`youtube.com/@handle`, `youtube.com/channel/UC…`)를 붙여 넣으면 그 안의 핸들이나 채널 ID를 꺼낸다(%로 인코딩된 핸들은 푼다). 채널을 알 수 없는 주소와 공백이 있는 글은 null이라 추가 버튼이 눌리지 않는다. 그대로 넣으면 아무에게도 걸리지 않는 항목이 된다.
- `entryKey(entry)` 같은 대상을 가리키는 항목인지 가리는 키. 목록에서 중복을 막고, 속성 값으로도 쓴다.
- `isExpired(entry, now)`.

## UI

- `hooks/useSettings.ts` `loadSettings()`로 초기값을 읽고 `watchSettings()`로 구독한다. `update(patch)`는 `updateSettings()`를 부르고 그 결과로 바로 그린다.
- `hooks/useBlocked.ts` `loadBlocked()`로 읽고 `watchBlocked()`로 구독한다. 쓰기는 `blocklist.ts`의 `addBlock`/`removeBlock`을 그대로 내보낸다. 팝업은 읽기만 하고 차단 목록 페이지가 읽고 쓴다.
- `entrypoints/popup/App.tsx` 맨 위 줄의 차단 기능 스위치, 차단한 수와 "차단 목록 관리" 버튼, 영구 차단 설정(표시 방법), 임시 차단 설정(기간, 표시 방법), 답글도 함께 가리기와 디버그 패널 스위치. 폭 360px이고 높이는 크롬 팝업 한도인 600px 안에 들어가게 잡았다.
  - 차단 기능 스위치는 맨 위 줄 오른쪽 끝, "설정" 옆에 스위치만 있다(`Switch`의 `hideText`). 이름과 설명은 화면 읽기 프로그램이 읽고, 이름은 마우스를 올리면 나온다. 꺼도 아래 설정은 그대로 바꿀 수 있다.
  - 표시 방법은 세 칸 버튼(`Segmented`)으로 고르고, 그 아래에 고른 방법으로 댓글이 어떻게 보이는지 한 줄 미리보기(`ModePreview`)가 있다. 미리보기는 `aria-hidden`이다.
  - 기간은 1일·7일·30일·직접 네 칸이고 ms 하나로 저장한다. 직접을 고르면 "기간" 줄 오른쪽에 숫자와 시간/일이 나온다. 직접을 고르기만 해서는 저장하지 않는다.
  - 스위치는 `role="switch"`인 체크박스를 CSS로 그린다. 줄 어디를 눌러도 바뀐다.
  - 수는 만료된 임시 차단을 빼고 센다. 차단 목록 페이지가 보여 주는 수와 같다.
  - 설정 페이지로 가는 길이 둘이다. "차단 목록 관리"는 차단 목록 탭, 맨 위 줄 오른쪽의 "설정"은 언어 탭을 연다(`popup/openSettings.ts`). 설정 페이지가 이미 열려 있으면 새 탭을 만들지 않는다. `extension.getViews`로 그 페이지를 찾아 주소의 `#`을 바꿔 탭을 옮기고(`hashchange`), `runtime.openOptionsPage()`로 그 브라우저 탭으로 간다. 닫혀 있으면 `tabs.create`로 `options.html#language`처럼 연다. `tabs.query`로 열린 탭의 주소를 보려면 `tabs` 권한이 더 필요해서 이렇게 했다.
  - 동기화 한도 안내가 있으면 그 아래에 한 줄. "오래전에 차단한 n명은 다른 PC와 동기화 안 됨" 또는 "동기화 공간 n% 사용 중"
- `entrypoints/onboarding/App.tsx` 첫 사용 안내. 네 쪽을 이전·다음으로 넘긴다. ① 차단하는 법(장면) ② 영구 차단 표시 방법 ③ 임시 차단 기간과 표시 방법 ④ 고른 것 요약과 "유튜브로 가기". 이유는 [decisions.md](decisions.md) "첫 사용 안내".
  - 맨 위 줄 오른쪽에서 언어를 고른다(브라우저 언어 따름 + 다섯 언어). 고르면 바로 저장되고 이 페이지와 열린 다른 화면이 모두 그 언어로 바뀐다. 예시 댓글도 언어마다 따로 있다(`locales/`의 `samples`).
  - 1쪽 장면(`HowToBlock`). 가짜 커서가 댓글로 다가가면 CleanTube 버튼이 나타나고, 버튼을 누르면 메뉴가 열린다. 5.5초마다 되풀이한다. 움직임은 `motion.ts`의 `playHowTo`가 Web Animations API로 건다(`id`가 `how-cursor`, `how-trigger`, `how-menu`). 커서가 갈 자리는 걸 때마다 실제 댓글 글과 버튼의 위치를 재서 정하고, 장면 크기가 바뀌면(`ResizeObserver`) 다시 재서 하던 데서 이어 간다. 움직임 줄이기(`prefers-reduced-motion`)면 장면을 걸지 않아 메뉴가 열린 정지 화면이고, 설정이 바뀌면 바로 멈추거나 다시 돈다. 그림 전체가 `aria-hidden`이고 `inert`다.
  - 2·3쪽(`ModeStep`)의 표시 방법은 아무 칸도 고르지 않은 상태로 시작한다. 이 안내에서 고른 것은 `App`의 `chosen`에 따로 들고, 고르면 설정에도 저장한다. 고르지 않고 넘어가면 저장된 설정이 그대로 남는다. 이전 쪽으로 돌아가면 고른 칸과 그 모습이 그대로다.
  - 같은 쪽에 "답글도 함께 가리기" 스위치가 있다. 설정은 하나라 두 쪽의 스위치가 같은 값이다. 스위치는 늘 자리에 있고, 아직 안 골랐거나 완전히 숨기기면 꺼 둔다(`disabled`). 자리가 생겼다 없어지면 아래 예시가 들썩여서다. 설명 한 줄도 늘 한 줄 자리를 둔다.
  - 고른 값은 `useSettings`로 바로 저장한다. "건너뛰기"는 `tabs.getCurrent`와 `tabs.remove`로 이 탭을 닫는다. 끝 쪽에는 없다.
  - 쪽을 넘기면 지금 쪽이 150ms 동안 사라지고(`motion.ts`의 `leave`) 다음 쪽이 220ms 동안 살짝 올라오며 나타난다(`enter`). 둘 다 Web Animations API라 시간은 `motion.ts`에만 있고, 사라지기가 끝나는 것을 기다렸다가 쪽을 바꾼다. 다음 쪽은 `key`가 바뀌어 새로 만들어진다. 움직임 줄이기면 바로 바뀐다. 누른 순간에 설정을 읽는다. 새 쪽의 제목(`tabIndex=-1`)에 포커스를 옮긴다. 처음 열 때는 옮기지 않는다.
  - `CommentSample.tsx` 유튜브 댓글란을 흉내 낸 예시. 유튜브와 같은 태그 이름(`ytd-comment-thread-renderer`, `ytd-comment-view-model`, `ytd-comment-replies-renderer`)으로 그리고, 가리는 일은 콘텐츠 스크립트의 `applyDisplay`가 한다. 그래서 고르거나 바꾸면 유튜브에서 차단할 때와 같은 애니메이션으로 접히고 흐려지고 바뀌며, "숨긴 항목 보기"도 같은 코드로 열린다. 처음 그릴 때(돌아왔을 때)만 움직이지 않고 바로 맞춘다. 가운데 스레드에 답글 둘이 달려 있다.
    - 처음 그릴 때의 높이를 `min-height`로 붙잡는다. 아무것도 가리지 않은 처음이 가장 길어서, 댓글이 접혀도 예시 상자와 아래 단추가 움직이지 않는다. "숨긴 항목 보기"로 연 문구 한 줄만큼은 늘어난다.
    - `display.ts`가 넣는 가림막과 속성은 React가 모르는 DOM이다. 이 요소들의 React 자식은 바뀌지 않아서 서로 부딪치지 않는다.
  - `main.tsx`가 `base.css` 다음에 `youtube.content/style.css`와 `menu.css`를 가져온다. 예시의 가림막, 메뉴 버튼, 메뉴가 유튜브에서와 같은 CSS로 그려진다. 같은 무게의 규칙(버튼 hover)은 뒤에 온 유튜브 쪽이 이긴다.
  - 예시의 테마는 `prefers-color-scheme`를 따라 `<html dark>`와 메뉴의 `.dark`를 켠다. style.css와 menu.css가 유튜브처럼 그것으로 어두운 테마를 받는다.
- `entrypoints/options/App.tsx` 설정 페이지. "차단 목록"과 "언어" 두 탭이다(`role="tablist"`, 화살표로 옮긴다). 주소가 `#language`면 언어 탭으로 열리고, 탭을 바꾸면 주소에 적는다(`replaceState`). 차단 목록 탭은 `BlockList` 하나와 댓글 메뉴로도 차단할 수 있다는 안내, 언어 탭은 브라우저 언어 따름과 다섯 언어 중 하나를 고르는 라디오다. 언어 이름은 그 언어로 적고 `lang`을 단다. 맨 위 줄에 로고와 "설정", 그 아래는 가운데 760px 한 단이다. 목록을 팝업이 아니라 여기 둔 이유는 [decisions.md](decisions.md) "차단 목록은 옵션 페이지에, 설정은 팝업에".
  - 동기화 한도 안내가 있으면 목록 위에 팝업보다 긴 글로 띄운다. 이 PC에서는 그대로 가려진다는 것, 다 차면 무엇이 빠지는지까지.
- `hooks/useSyncWarning.ts` `loadSyncStatus()`로 읽고 `watchSyncStatus()`로 구독해 `syncWarning()`의 안내를 돌려준다.
- `utils/duration.ts` `HOUR_MS`, `DAY_MS`, `formatDuration(ms)`. 팝업과 댓글 메뉴가 같은 표기("7일", "3시간")를 쓰게 한다.
- `components/BlockList.tsx` 차단 목록 보기와 편집. 차단 목록 페이지가 쓴다. 손으로 넣는 항목은 영구 차단이다. 만료된 항목은 보여 주지 않는다. 스타일은 옆의 `BlockList.css`.
  - 맨 위에 전체 수(큰 숫자), 검색창, "직접 추가" 버튼. 그 아래에 "영구 차단"과 "임시 차단" 두 묶음(`Group`). 묶음마다 제목, 수, 정렬 버튼, 칸 이름 줄, 목록, 쪽 버튼이 있다. 비어 있는 묶음도 제목은 남고 "아직 없음"가 나온다. 임시 차단 묶음은 제목 앞 네모, 제목 아래 줄, 고른 정렬이 호박색이다.
  - 손으로 넣는 입력칸은 접혀 있고 "직접 추가"로 펼치고 접는다. 펼치면 버튼의 +가 45도 돌아 ×가 되고 입력칸에 포커스가 간다. 접혀 있을 때는 `inert`다. 높이는 CSS만으로 움직인다(`.add`의 grid 행을 `0fr`↔`1fr`, 220ms). 자르는 상자(`.add-clip`)는 좌우로 4px 넓다. 딱 맞게 자르면 입력칸의 포커스 테두리가 잘린다. 펼침 상태는 저장하지 않는다.
  - 줄은 표처럼 칸을 나눈다. 작성자(핸들, 없으면 채널 ID), 임시면 풀리는 때, 채널 ID(핸들이 작성자 칸에 나갔을 때만), 버튼 둘. 칸 이름 줄은 눈으로 보는 머리글이라 `aria-hidden`이다. 영구인지 임시인지는 묶음 제목이 말하므로 줄에는 적지 않는다.
  - 정렬은 묶음마다 따로 고른다. 최근에 차단한 순(기본), 오래된 순, 이름순이 있고 임시 차단에는 곧 풀리는 순이 더 있다. 항목이 둘 이상일 때만 정렬 버튼이 보인다. 고른 값은 컴포넌트 상태라 페이지를 다시 열면 기본으로 돌아간다. 저장된 순서는 바꾸지 않는다.
    - 차단한 때(`at`)가 없는 예전 항목은 가장 오래된 것으로 친다. 때가 같거나 없는 항목끼리는 저장된 순서(넣은 순서)를 따른다.
    - 이름순은 대소문자를 가리지 않는다. 핸들이 적은 대로 저장돼 있어서다.
  - 쪽. 묶음마다 20개(`PAGE_SIZE`, 임시값)씩 나눠 보여 준다. 목록 아래 오른쪽에 "← 이전", "2/3", "다음 →"이 있고, 한 쪽에 다 들어가면 나오지 않는다. 정렬이나 검색어를 바꾸면 첫 쪽으로 가고, 항목을 빼서 보던 쪽이 없어지면 마지막 쪽을 보여 준다. 쪽을 넘기면 묶음 제목이 화면 밖에 있을 때 화면에 들인다. 보던 쪽은 저장하지 않는다.
  - 검색. 맨 위 오른쪽의 검색창 하나가 두 묶음을 같이 거른다. 쪽으로 나뉘어 있어서 브라우저의 찾기로는 다른 쪽의 항목을 못 찾기 때문에 둔다. 핸들과 채널 ID에서 대소문자를 가리지 않고 일부만 맞아도 찾는다(`matchesQuery`). 차단한 경위에서는 찾지 않는다. 검색 중에는 묶음의 수가 걸린 수이고 맨 위의 전체 수는 그대로다. 걸린 게 없는 묶음에는 "찾는 작성자 없음"가 나온다. 검색어는 저장하지 않는다.
    - 묶음은 보던 쪽을 그때의 검색어와 같이 기억한다. 검색어가 다르면 첫 쪽으로 친다. effect로 되돌리면 한 번은 엉뚱한 쪽이 그려진다.
  - 항목마다 펼치기 버튼이 있다. 펼치면 차단한 때, 영상 제목, 댓글 내용, "이 댓글로 이동" 링크가 나온다. 두 묶음을 통틀어 한 번에 하나만 펼친다. `at`도 `source`도 없는 예전 항목에는 버튼이 없다. 경위는 동기화하지 않아서, 다른 PC에서 차단한 항목은 차단한 때와 "이 PC에 기록 없음"만 나온다.
  - 링크는 저장된 주소가 유튜브의 https 주소일 때만 만든다. 저장소에 있는 값을 그대로 믿지 않는다.
- `assets/base.css` 팝업, 차단 목록 페이지, 첫 사용 안내의 기본 스타일. 색 변수, 글꼴, 버튼, 입력창, 여러 칸 버튼(`.segmented`), 영구·임시 표시 네모(`.kind-mark`), 탭 페이지의 맨 위 줄(`.page-bar`), 이름표 붙은 설정 칸(`.field`), 스위치(`.switch`), 안내 상자(`.notice`). 색은 뜻이 있을 때만 쓴다. 검정(`--fg`)은 영구 차단, 호박색(`--temp`)은 임시 차단이다. `.temporary` 안에 있으면 네모와 고른 칸이 호박색이 된다. 고정폭 글꼴 IBM Plex Mono(`--mono`, `.mono`)는 `@fontsource/ibm-plex-mono`의 라틴 글자 파일만 가져와 숫자와 @핸들·채널 ID에 쓴다. 이유는 [decisions.md](decisions.md) "팝업과 차단 목록 페이지의 디자인: 계기판".
- `components/Segmented.tsx` 여러 칸 중 하나를 고르는 버튼 묶음. `aria-pressed`로 고른 칸을 알린다. 이미 고른 칸을 다시 누르면 아무것도 하지 않는다. `value`가 null이면 아무 칸도 고르지 않은 상태다. 팝업과 첫 사용 안내의 표시 방법·기간, 차단 목록의 정렬이 쓴다.
  - 칸 너비가 같은 묶음(`sliding`, 기본)은 고른 칸 뒤에 색 덩어리(`.segmented-thumb`)를 깔고, 고른 칸이 바뀌면 덩어리가 200ms 동안 미끄러져 옮겨 간다. 칸 수와 순서는 `--count`, `--index`로 CSS에 넘긴다. 아무것도 고르지 않았으면 덩어리를 감춘다. 칸 너비가 글자마다 다른 정렬 버튼은 `sliding={false}`로 고른 칸만 칠한다.
- `components/displayModes.ts` 표시 방법의 선택지와 이름(`displayModeOptions(t)`, `displayModeLabel(mode, t)`), 언어 선택지(`languageOptions(t, browserLocale)`). 팝업, 설정, 첫 사용 안내가 쓴다.
- `hooks/useI18n.tsx` `I18nProvider`와 `useI18n()`. 위 "언어".
- `components/DurationField.tsx` 임시 차단 기간. 1일·7일·30일·직접 네 칸이고 ms 하나로 저장한다. 직접을 고르면 "기간" 줄 오른쪽에 숫자와 시간/일이 나오고, 고르기만 해서는 저장하지 않는다. 1~9999의 정수만 저장한다(입력칸의 `max`는 브라우저가 막아 주지 않아서 저장할 때도 본다). 팝업과 첫 사용 안내가 쓴다.
- `components/Switch.tsx` 켜고 끄는 설정 한 줄. `role="switch"`인 체크박스를 CSS로 그린다. 제목과 설명은 `aria-labelledby`·`aria-describedby`로 잇는다. `disabled`면 자리는 그대로 두고 흐리게 보인다. `hideText`면 스위치만 보이고 제목과 설명은 `.sr-only`로 화면 읽기 프로그램만 읽으며, 제목을 `title`로도 단다. 팝업과 첫 사용 안내가 쓴다.
- `components/Logo.tsx` 팝업과 차단 목록 페이지 맨 위의 로고. 툴바 아이콘과 같은 그림이고 글자색을 따라간다.
- `assets/icon/` 툴바 아이콘의 SVG 원본. `icon-16.svg`는 16px용, `icon.svg`는 그 밖의 크기용이다. `public/icon/`의 PNG는 이것을 헤드리스 크롬으로 그린 것이다.
