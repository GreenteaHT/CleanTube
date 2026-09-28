# CleanTube

유튜브 영상과 댓글을 키워드·채널 기준으로 숨기거나 흐리게 처리하는 크롬 확장기능.
WXT + React + TypeScript, Manifest V3.

## 명령어

- `npm run dev` 확장기능이 로드된 크롬을 띄운다. 코드를 고치면 자동 반영.
- `npm run build` `.output/chrome-mv3/`에 빌드.
- `npm run compile` 타입 검사만. 커밋 전에 돌린다.
- `npm run zip` 스토어 제출용 zip.

## 구조

자세한 건 [docs/architecture.md](docs/architecture.md). 요약:

- `entrypoints/youtube.content/` 유튜브 페이지에서 DOM을 감시해 `data-cleantube` 속성을 토글한다.
- `entrypoints/popup/`, `entrypoints/options/` React UI. 둘 다 `useSettings` 훅으로 설정을 읽고 쓴다.
- `utils/settings.ts` Settings 타입과 storage 정의. 설정 항목을 추가할 때 여기서 시작.
- `utils/matcher.ts` 순수 매칭 함수. 브라우저 API 의존 금지.

## 규칙

- 식별자는 영어, 주석과 문서는 한글.
- 주석은 "왜"만 적는다. "무엇을"은 이름과 타입으로 설명한다.
- `utils/matcher.ts`는 DOM, storage, WXT를 import하지 않는다. 단위 테스트가 가능해야 한다.
- 콘텐츠 스크립트는 DOM을 지우지 않는다. 속성만 토글해서 설정을 바꾸면 되돌릴 수 있게 한다.
- 새 설정 항목은 `Settings` 타입, `DEFAULT_SETTINGS`, UI, 콘텐츠 스크립트 순서로 추가한다.
- 유튜브 셀렉터를 추가하거나 바꾸면 어느 화면의 어떤 요소인지 주석에 적는다.

## 커밋

Conventional Commits, 영어.

- 형식 `type(scope): subject`. subject는 소문자 명령형, 마침표 없음, 50자 안팎.
- type: `feat` `fix` `docs` `refactor` `chore` `style` `test`
- scope: `content` `popup` `options` `settings` `matcher` `deps`. 애매하면 생략.
- 예: `feat(popup): add quick keyword input`, `fix(content): re-apply after spa navigation`, `chore(deps): bump wxt to 0.22`

## 문서

- [docs/architecture.md](docs/architecture.md) 구조와 데이터 흐름.
- [docs/decisions.md](docs/decisions.md) 설계 결정과 이유. 큰 결정을 하면 여기에 추가한다.
- [docs/backlog.md](docs/backlog.md) 할 일. 작업을 시작하기 전에 확인한다.
- `notes/` 개인 메모. git에 올라가지 않는다.
