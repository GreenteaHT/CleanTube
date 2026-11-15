import { defineConfig } from 'wxt';

// 파일 구조에서 알 수 없는 manifest 항목만 여기에 적는다.
// entrypoints/ 폴더의 파일들은 WXT가 읽어서 manifest에 자동으로 넣어준다.
// See https://wxt.dev/api/config.html
export default defineConfig({
  // utils/, hooks/, components/의 export를 import 없이 전역으로 쓰게 하는 auto-import를 끈다.
  // import를 적어야만 쓸 수 있어야, storage 항목처럼 모듈 안에 둔 것이 밖에서 보이지 않는다. '#imports'는 그대로 된다.
  imports: false,
  modules: ['@wxt-dev/module-react'],
  manifest: {
    // 이름과 설명은 public/_locales에서 브라우저 언어로 고른다. 확장 안의 화면 글은 locales/에 따로 있다(utils/i18n.ts)
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    // scripting과 유튜브 호스트 권한은 업데이트 뒤 열려 있는 유튜브 탭에 새 콘텐츠 스크립트를 넣는 데 쓴다(background.ts).
    // 호스트는 콘텐츠 스크립트의 matches와 같아서 설치할 때의 권한 안내가 늘지 않는다.
    permissions: ['storage', 'scripting'],
    host_permissions: ['*://*.youtube.com/*'],
  },
});
