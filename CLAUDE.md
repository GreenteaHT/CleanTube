# CleanTube

유튜브에서 지정한 작성자의 댓글을 가리는 크롬 확장기능.
WXT + React + TypeScript, Manifest V3. 기능을 하나씩 늘려 가는 중이다.

## 명령어

- `npm run dev` 확장기능이 로드된 크롬을 띄운다. 코드를 고치면 자동 반영.
- `npm run build` `.output/chrome-mv3/`에 빌드.
- `npm run compile` 타입 검사만. 커밋 전에 돌린다.
- `npm test` 단위 테스트(vitest). `utils/matcher.ts`나 `utils/blocksync.ts`를 고치면 돌린다.
- `npm run zip` 스토어 제출용 zip.

## 구조

자세한 건 [docs/architecture.md](docs/architecture.md). 요약:

- `entrypoints/youtube.content/` 유튜브 페이지에서 댓글을 감시해 작성자가 차단 목록에 있으면 표시 방법에 맞는 속성을 붙인다. `display.ts`는 표시 방법 적용(무엇을 가릴지, 애니메이션, 가림막), `source.ts`는 차단한 댓글의 주소·제목·내용 읽기, `menu.ts`는 댓글 메뉴, `panel.ts`는 디버그 패널(둘 다 Shadow DOM, React 없음).
- `entrypoints/youtube-main.content.ts` 페이지(MAIN) 세계에서 돈다. 유튜브가 댓글 요소에 달아 둔 데이터에서 채널 ID를 읽어 `data-cleantube-channel-id` 속성으로 적는다.
- `entrypoints/popup/` React UI. 차단한 수와 차단 목록 페이지를 여는 버튼, 동기화 한도 안내, 표시 방법, 디버그 패널 토글. `useSettings`, `useBlocked`, `useSyncWarning` 훅으로 읽고 쓴다.
- `entrypoints/options/` React UI. 차단 목록 페이지. 탭 하나로 열린다. 목록 보기와 편집은 여기에만 있다. `useBlocked` 훅으로 읽고 쓴다.
- `entrypoints/onboarding/` React UI. 첫 사용 안내. 처음 설치하면 탭으로 열린다. 차단하는 법을 보여 주고 표시 방법·기간·답글 범위를 예시 댓글을 보며 고르게 한다. 예시 댓글은 유튜브와 같은 태그 이름으로 그리고 `display.ts`의 `applyDisplay`와 `style.css`·`menu.css`를 그대로 써서 유튜브에서처럼 가리고 움직인다. 그쪽을 고치면 예시도 같이 확인한다.
- `entrypoints/background.ts` 서비스 워커. 처음 설치하면 첫 사용 안내 탭을 열고, 차단 목록을 다른 PC와 맞춘다. 차단 목록의 `storage.sync`는 여기서만 쓴다.
- `utils/blocklist.ts` 차단 목록. `storage.local`. 읽기 `loadBlocked`, 구독 `watchBlocked`, 쓰기는 `addBlock`/`removeBlock`(항목 하나)과 `blockAuthor`/`unblockAuthor`(그 작성자에게 걸린 것 전부)로만 한다. 뺀 항목은 뺀 시각을 남긴다. 다른 PC와 맞추는 `syncBlocked`는 백그라운드만 부른다.
- `utils/blocksync.ts` 차단 목록을 sync에 나눠 담고 다른 PC의 것과 합치는 순수 함수. 테스트는 `tests/blocksync.test.ts`.
- `utils/settings.ts` Settings 타입과 `storage.sync` 정의. 설정 항목을 추가할 때 여기서 시작. 읽기 `loadSettings`, 구독 `watchSettings`, 쓰기는 `updateSettings`로만 한다.
- `utils/matcher.ts` 순수 매칭 함수. 브라우저 API 의존 금지. 테스트는 `tests/matcher.test.ts`.
- `utils/duration.ts` 기간 상수와 표기("7일", "3시간").
- `utils/youtube.ts` 두 콘텐츠 스크립트가 같이 쓰는 셀렉터와 속성·이벤트 이름.

## 용어

- "차단"은 누구를 가릴지다. 영구 차단과 임시 차단(기간이 지나면 풀림)이 있다.
- "표시 방법"은 차단된 댓글이 어떻게 보일지다. 완전히 숨기기, 흐리게, 문구로 바꾸기("차단된 댓글" 한 줄로).
- UI 글자에 "숨기기"를 "차단"의 뜻으로 쓰지 않는다.
- UI 글은 명사형·개조식으로 쓴다. "-요", "-다", "-니다"로 끝내지 않는다("찾는 작성자 없음", "기간 변경은 새로 거는 임시 차단부터 적용"). 첫 사용 안내의 예시 댓글처럼 사람이 쓴 글을 흉내 낸 것은 예외.

## 진행 방식

- 단계를 나누지 않고 이어서 개발한다. 사용자가 정한 기능만 만든다. "이왕이면" 식으로 덧붙이지 않는다.
- 대상은 유튜브만. 다른 사이트를 위한 추상화를 미리 만들지 않는다.
- 할 일과 후보는 [docs/backlog.md](docs/backlog.md)에 둔다. 기능을 만들면 실제 유튜브에서 확인한다.
- 큰 결정은 [docs/decisions.md](docs/decisions.md)에 이유와 함께 적는다. 코드에 있다고 결정은 아니다. 수치는 실측 전엔 임시값이라고 표시한다.

## 코드 규칙

- 식별자는 영어, 주석과 문서는 한글.
- 주석은 "왜"만 적는다. "무엇을"은 이름과 타입으로 설명한다.
- `utils/matcher.ts`와 `utils/blocksync.ts`는 DOM, storage, WXT를 import하지 않는다. 현재 시각도 인자로 받는다. 단위 테스트가 가능해야 한다.
- storage 항목(`defineItem`)은 `utils/blocklist.ts`와 `utils/settings.ts` 밖으로 내보내지 않는다. 그 두 파일이 내보내는 읽기·쓰기·구독 함수만 쓴다. WXT auto-import는 꺼 두었다. WXT API는 `#imports`에서, 우리 모듈은 `@/`에서 명시적으로 import한다.
- `entrypoints/youtube-main.content.ts`와 `utils/youtube.ts`는 페이지 세계에서 돈다. 확장기능 API(storage, runtime)를 쓰지 않는다.
- 콘텐츠 스크립트는 유튜브 DOM을 지우지 않는다. 가림은 속성만 토글해서 차단을 풀면 되돌아오게 한다. 우리 요소(메뉴 버튼, 가림막)를 추가하는 건 괜찮다.
- 표시 방법의 모양은 `style.css`에만 둔다. `display.ts`는 속성을 붙이고 뗄 뿐이다.
- 댓글 메뉴 항목은 `index.ts`의 `menuItems()`가 돌려주는 목록에 `{ label, run }` 한 줄로 추가한다. 고를 값이 여러 개인 설정(기간 같은 것)은 메뉴가 아니라 팝업에 둔다.
- `main()` 안에서 `let`/`const`는 그것을 쓰는 함수가 처음 불리기 전에 선언한다. 함수 선언은 끌어올려지지만 `let`은 아니어서, 순서가 틀리면 콘텐츠 스크립트가 시작하다 죽는다.
- 새 설정 항목은 `Settings` 타입, `DEFAULT_SETTINGS`, UI, 콘텐츠 스크립트 순서로 추가한다.
- 팝업과 차단 목록 페이지의 색은 `assets/base.css`의 변수로만 쓰고, 뜻이 있을 때만 쓴다. 검정은 영구 차단, 호박색은 임시 차단. 고정폭 글꼴은 숫자와 @핸들·채널 ID에만. 팝업은 크롬 한도인 600px 높이 안에 들어가야 한다.
- 유튜브 셀렉터를 추가하거나 바꾸면 어느 화면의 어떤 요소인지 주석에 적는다.

## 커밋

- 커밋은 사용자 허락을 받고 만든다. 푸시는 사용자가 직접 한다.
- Conventional Commits, 영어. 형식 `type(scope): subject`. subject는 소문자 명령형, 마침표 없음, 50자 안팎.
- type: `feat` `fix` `docs` `refactor` `chore` `style` `test`
- scope: `content` `popup` `settings` `matcher` `deps`. 애매하면 생략.
- 예: `feat(content): hide comments by blocked author`, `chore(deps): bump wxt to 0.22`

## 문서

- [docs/architecture.md](docs/architecture.md) 구조와 데이터 흐름.
- [docs/decisions.md](docs/decisions.md) 설계 결정과 이유. 큰 결정을 하면 여기에 추가한다.
- [docs/backlog.md](docs/backlog.md) 할 일과 후보.
- `notes/` 개인 메모. git에 올라가지 않는다.
