import { browser, defineBackground } from '#imports';
import { syncBlocked, watchBlockSyncSources } from '@/utils/blocklist';

/**
 * 두 가지만 한다. 처음 설치하면 첫 사용 안내 탭을 연다. 그리고 차단 목록을 다른 PC와 맞춘다.
 * 유튜브 탭, 팝업, 차단 목록 페이지는 storage.local만 쓰고, sync는 여기 하나만 쓴다. 탭마다 쓰면 sync의 쓰기 한도에 걸리고 서로 덮어쓴다.
 * 서비스 워커라 할 일이 없으면 꺼지고, storage 변경 알림이 오면 다시 켜진다. 켜질 때마다 한 번 맞춘다.
 */
export default defineBackground(() => {
  // 업데이트나 크롬 업데이트 때는 열지 않는다. 이미 쓰던 사람에게 다시 묻지 않게.
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') void browser.tabs.create({ url: browser.runtime.getURL('/onboarding.html') });
  });

  // 한 번에 하나씩 돈다. 겹쳐 돌면 뒤의 것이 앞의 것이 쓴 것을 못 본 채 덮어쓴다.
  // 도는 동안 알림이 여러 번 오면 끝난 뒤 한 번만 더 돈다. 그때 최신 값을 다시 읽으므로 충분하다.
  let queue = Promise.resolve();
  let queued = false;
  const run = () => {
    if (queued) return;
    queued = true;
    queue = queue
      .then(() => {
        queued = false;
        return syncBlocked();
      })
      .catch((error: unknown) => console.warn('[CleanTube] 차단 목록 동기화 실패', error));
  };

  watchBlockSyncSources(run);
  run();
});
