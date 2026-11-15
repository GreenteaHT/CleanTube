import { browser, defineBackground } from '#imports';
import { syncBlocked, watchBlockSyncSources } from '@/utils/blocklist';
import { messagesFor, resolveLocale } from '@/utils/i18n';
import { loadSettings, watchSettings, type Settings } from '@/utils/settings';

/** 꺼짐 배지의 색. 꺼진 것은 뜻이 약한 회색으로. assets/base.css의 밝은 테마 --muted와 같은 값이다(배지는 CSS 변수를 못 쓴다). */
const BADGE_BACKGROUND = '#5c5c5c';
const BADGE_TEXT = '#ffffff';

/**
 * 네 가지를 한다. 처음 설치하면 첫 사용 안내 탭을 연다. 업데이트되면 열려 있는 유튜브 탭에 새 콘텐츠 스크립트를 넣는다.
 * 차단 목록을 다른 PC와 맞춘다. 차단 기능을 꺼 두면 툴바 아이콘에 배지를 붙인다.
 * 유튜브 탭, 팝업, 차단 목록 페이지는 storage.local만 쓰고, sync는 여기 하나만 쓴다. 탭마다 쓰면 sync의 쓰기 한도에 걸리고 서로 덮어쓴다.
 * 서비스 워커라 할 일이 없으면 꺼지고, storage 변경 알림이 오면 다시 켜진다. 켜질 때마다 한 번 맞춘다.
 */
export default defineBackground(() => {
  // 첫 사용 안내는 업데이트나 크롬 업데이트 때는 열지 않는다. 이미 쓰던 사람에게 다시 묻지 않게.
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') void browser.tabs.create({ url: browser.runtime.getURL('/onboarding.html') });
    if (reason === 'update') void reinjectContentScripts();
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

  // 꺼 둔 것을 잊으면 확장이 고장 난 것처럼 보여서 툴바에서 보이게 한다. 배지 글은 화면 언어를 따른다.
  void browser.action.setBadgeBackgroundColor({ color: BADGE_BACKGROUND });
  void browser.action.setBadgeTextColor({ color: BADGE_TEXT });
  const showBadge = (settings: Settings) => {
    const locale = resolveLocale(settings.language, browser.i18n.getUILanguage());
    void browser.action.setBadgeText({ text: settings.enabled ? '' : messagesFor(locale).badge.off });
  };
  // 처음 읽은 값이 그사이 바뀐 값보다 늦게 오면 옛 값으로 덮어쓴다. 구독이 먼저 왔으면 처음 읽은 값은 버린다
  let watched = false;
  watchSettings((settings) => {
    watched = true;
    showBadge(settings);
  });
  void loadSettings().then((settings) => {
    if (!watched) showBadge(settings);
  });
  // 브라우저를 켤 때도 이 워커가 돌아 위에서 배지를 맞추게 한다. 배지가 브라우저를 다시 켠 뒤에도 남아 있는지에 기대지 않는다.
  browser.runtime.onStartup.addListener(() => {});
});

/**
 * 열려 있는 유튜브 탭에 새 콘텐츠 스크립트를 넣는다. 크롬은 확장을 업데이트해도 이미 열린 탭에는 넣어 주지 않는다.
 * 그 탭의 옛 스크립트는 끊겨서 붙여 둔 가림과 메뉴 버튼을 떼고 멈추므로, 넣지 않으면 새로 고칠 때까지 차단이 풀려 있다.
 * 주소 패턴과 세계는 두 콘텐츠 스크립트(entrypoints/youtube*.content)에 적은 것과 같아야 한다. 파일 이름은 WXT가 타입으로 검사한다.
 */
async function reinjectContentScripts() {
  for (const { id } of await browser.tabs.query({ url: '*://*.youtube.com/*' })) {
    if (id === undefined) continue;
    const target = { tabId: id };
    try {
      // 옛 CSS는 탭에 남아 있다(실측). 새 CSS를 뒤에 얹어 바뀐 규칙이 이기게 한다.
      await browser.scripting.insertCSS({ target, files: ['/content-scripts/youtube.css'] });
      await browser.scripting.executeScript({ target, world: 'MAIN', files: ['/content-scripts/youtube-main.js'] });
      await browser.scripting.executeScript({ target, files: ['/content-scripts/youtube.js'] });
    } catch {
      // 잠든 탭이나 오류 페이지에는 넣을 수 없다. 그런 탭은 다시 불러올 때 크롬이 넣는다
    }
  }
}
