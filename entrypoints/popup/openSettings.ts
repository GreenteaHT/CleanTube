import { browser } from '#imports';

export type SettingsTab = 'blockList' | 'language';

/**
 * 설정 페이지를 그 탭으로 연다. 이미 열려 있으면 새 탭을 만들지 않고, 그 페이지의 주소(#)만 바꿔 탭을 옮긴 뒤 그 브라우저 탭으로 간다.
 * openOptionsPage()는 열린 페이지로 가 주지만 주소를 넘길 수 없고, tabs.create()는 주소를 넘길 수 있지만 열린 것을 모른다.
 * 열린 페이지는 extension.getViews로 찾는다. tabs.query로 주소를 보려면 tabs 권한이 더 필요해서.
 */
export async function openSettings(tab: SettingsTab): Promise<void> {
  const url = browser.runtime.getURL('/options.html');
  const hash = tab === 'language' ? '#language' : '';
  // 타입 정의는 창을 location 없는 모양으로 적어 두었지만, 실제로는 이 페이지의 window와 같은 창이다
  const views = browser.extension.getViews({ type: 'tab' }) as unknown as globalThis.Window[];
  const page = views.find((view) => view.location.href.split('#')[0] === url);
  if (page) {
    // 설정 페이지가 hashchange를 듣고 탭을 바꾼다(options/App.tsx). 팝업이 닫히기 전에 먼저 바꾼다
    page.location.hash = hash;
    await browser.runtime.openOptionsPage();
  } else {
    await browser.tabs.create({ url: url + hash });
  }
}
