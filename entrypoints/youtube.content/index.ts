import { defineContentScript } from '#imports';
import { DEFAULT_SETTINGS, settingsItem, type Settings } from '@/utils/settings';
import { findAuthor } from '@/utils/matcher';
import './style.css';

/**
 * 숨길 댓글에 붙이는 속성. 값은 매칭된 차단 목록 항목이라 DevTools에서 왜 숨겨졌는지 바로 보인다.
 * 실제 숨김은 style.css가 이 속성을 보고 처리한다.
 * DOM을 지우지 않고 속성만 토글하므로 목록에서 빼면 되돌아온다.
 */
const ATTR = 'data-cleantube-blocked';

/** 개별 댓글. 최상위 댓글과 답글 모두 해당. ytd-comment-renderer는 구형 마크업. */
const COMMENT_SELECTOR = 'ytd-comment-view-model, ytd-comment-renderer';

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
      for (const el of document.querySelectorAll<HTMLElement>(COMMENT_SELECTOR)) {
        const hit = findAuthor(authorIds(el), settings.blockedAuthors);
        if (hit) {
          if (el.getAttribute(ATTR) !== hit) el.setAttribute(ATTR, hit);
        } else if (el.hasAttribute(ATTR)) {
          el.removeAttribute(ATTR);
        }
      }
    }
  },
});

/**
 * 댓글에서 작성자를 식별할 수 있는 문자열을 모두 모은다.
 * 화면에 보이는 텍스트("@handle" 또는 채널명)와 링크의 핸들 둘 다.
 * 사용자가 어느 쪽을 입력해도 매칭되도록.
 */
function authorIds(comment: Element): string[] {
  const ids: string[] = [];

  const author = comment.querySelector<HTMLElement>('#author-text');
  if (!author) return ids;

  const text = author.textContent?.trim();
  if (text) ids.push(text);

  // #author-text 자체가 <a>인 경우와 안에 <a>가 있는 경우 둘 다 본다.
  const link = author.closest('a') ?? author.querySelector('a');
  const handle = link?.getAttribute('href')?.match(/\/@([^/?#]+)/)?.[1];
  if (handle) ids.push(`@${handle}`);

  return ids;
}
