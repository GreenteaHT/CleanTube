# CleanTube

유튜브에서 지정한 작성자의 댓글을 숨기는 크롬 확장기능.
WXT + React + TypeScript, Manifest V3. 한 단계씩 기능을 늘려 가는 중이다.

## 명령어

- `npm run dev` 확장기능이 로드된 크롬을 띄운다. 코드를 고치면 자동 반영.
- `npm run build` `.output/chrome-mv3/`에 빌드.
- `npm run compile` 타입 검사만. 커밋 전에 돌린다.
- `npm run zip` 스토어 제출용 zip.

## 구조

자세한 건 [docs/architecture.md](docs/architecture.md). 요약:

- `entrypoints/youtube.content/` 유튜브 페이지에서 댓글을 감시해 작성자가 차단 목록에 있으면 `data-cleantube-blocked` 속성을 붙인다.
- `entrypoints/popup/` React UI. 차단 작성자 목록 편집. `useSettings` 훅으로 설정을 읽고 쓴다.
- `utils/settings.ts` Settings 타입과 storage 정의. 설정 항목을 추가할 때 여기서 시작.
- `utils/matcher.ts` 순수 매칭 함수. 브라우저 API 의존 금지.

## 진행 방식

- 한 번에 한 단계. 사용자가 정한 기능만 만든다. "이왕이면" 식으로 덧붙이지 않는다.
- 대상은 유튜브만. 다른 사이트를 위한 추상화를 미리 만들지 않는다.
- 단계를 시작할 때 [docs/backlog.md](docs/backlog.md)에서 범위를 정하고, 끝나면 실제 유튜브에서 확인한다.
- 큰 결정은 [docs/decisions.md](docs/decisions.md)에 이유와 함께 적는다. 코드에 있다고 결정은 아니다. 수치는 실측 전엔 임시값이라고 표시한다.

## 코드 규칙

- 식별자는 영어, 주석과 문서는 한글.
- 주석은 "왜"만 적는다. "무엇을"은 이름과 타입으로 설명한다.
- `utils/matcher.ts`는 DOM, storage, WXT를 import하지 않는다. 단위 테스트가 가능해야 한다.
- 콘텐츠 스크립트는 DOM을 지우지 않는다. 속성만 토글해서 목록에서 빼면 되돌아오게 한다.
- 새 설정 항목은 `Settings` 타입, `DEFAULT_SETTINGS`, UI, 콘텐츠 스크립트 순서로 추가한다.
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
- [docs/backlog.md](docs/backlog.md) 현재 단계의 할 일과 다음 단계 후보.
- `notes/` 개인 메모. git에 올라가지 않는다.
