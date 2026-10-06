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
    name: 'CleanTube',
    description: '유튜브에서 지정한 작성자의 댓글을 가립니다.',
    permissions: ['storage'],
  },
});
