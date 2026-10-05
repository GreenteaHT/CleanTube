import { defineContentScript } from '#imports';
import { DEFAULT_SETTINGS, settingsItem, type Settings } from '@/utils/settings';
import { findAuthor, type Author } from '@/utils/matcher';
import { CHANNEL_ID_ATTR, CHANNEL_ID_REQUEST, COMMENT_SELECTOR } from '@/utils/youtube';
import './style.css';

/**
 * 숨길 댓글에 붙이는 속성. 값은 매칭된 차단 목록 항목이라 DevTools에서 왜 숨겨졌는지 바로 보인다.
 * 실제 숨김은 style.css가 이 속성을 보고 처리한다.
 * DOM을 지우지 않고 속성만 토글하므로 목록에서 빼면 되돌아온다.
 */
const ATTR = 'data-cleantube-blocked';

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  runAt: 'document_idle',

  async main(ctx) {
    let settings: Settings = await settingsItem.getValue();

    // DOM 변경이 몰려와도 150ms에 한 번만 스캔한다. 값은 임시. 실측 후 다시 정한다 (backlog).
    let timer: number | undefined;
    const schedule = () => {
      if (timer !== undefined) return;
      timer = ctx.setTimeout(() => {
        timer = undefined;
        applyAll();
      }, 150);
    };

    // 유튜브는 SPA라 페이지를 옮겨도 스크립트가 다시 실행되지 않는다.
    // 댓글은 스크롤해야 뒤늦게 붙기도 한다. 그래서 DOM 변경을 감시해서 그때마다 스캔한다.
    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());

    // 팝업에서 목록을 바꾸면 즉시 반영
    const unwatch = settingsItem.watch((next) => {
      settings = next ?? DEFAULT_SETTINGS;
      applyAll();
    });
    ctx.onInvalidated(unwatch);

    applyAll();

    function applyAll() {
      // 채널 ID는 페이지 세계에서만 읽을 수 있어서 youtube-main 스크립트에 적어 달라고 요청한다.
      // dispatchEvent는 듣는 쪽이 끝나야 돌아오므로 아래 루프가 돌 때는 속성이 이미 최신이다.
      document.dispatchEvent(new Event(CHANNEL_ID_REQUEST));

      for (const el of document.querySelectorAll<HTMLElement>(COMMENT_SELECTOR)) {
        const hit = findAuthor(readAuthor(el), settings.blockedAuthors);
        if (hit) {
          if (el.getAttribute(ATTR) !== hit) el.setAttribute(ATTR, hit);
        } else if (el.hasAttribute(ATTR)) {
          el.removeAttribute(ATTR);
        }
      }
    }
  },
});

function readAuthor(comment: Element): Author {
  return {
    // 영상 페이지 댓글 헤더의 작성자 링크. 글자는 채널명이 아니라 "@handle"이다.
    // 인증·크리에이터 배지가 붙은 댓글은 이 링크가 hidden이 되고 배지가 대신 보이지만 글자는 남아 있다.
    // href의 핸들은 한글·일본어면 %로 인코딩돼 있어 쓰지 않는다.
    handle: comment.querySelector('#author-text')?.textContent?.trim(),
    channelId: comment.getAttribute(CHANNEL_ID_ATTR) ?? undefined,
  };
}
