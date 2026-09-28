import { defineConfig } from 'wxt';

// 파일 구조에서 알 수 없는 manifest 항목만 여기에 적는다.
// entrypoints/ 폴더의 파일들은 WXT가 읽어서 manifest에 자동으로 넣어준다.
// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'CleanTube',
    description: '유튜브 영상과 댓글을 키워드·채널 기준으로 숨기거나 흐리게 처리합니다.',
    permissions: ['storage'],
  },
});
