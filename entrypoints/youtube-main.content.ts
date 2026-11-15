import { defineContentScript } from '#imports';
import { CHANNEL_ID_ATTR, CHANNEL_ID_REQUEST, COMMENT_SELECTOR } from '@/utils/youtube';

/**
 * 유튜브가 댓글 요소에 달아 두는 데이터 중 우리가 읽는 부분.
 * 유튜브 내부 구조라 예고 없이 바뀔 수 있다. 2026-10에 두 브라우저에서 비교했을 때
 * 안쪽 깊은 필드는 서로 달랐고 author.channelId는 같았다. 그래서 여기까지만 기댄다.
 */
interface CommentElement extends HTMLElement {
  commentEntity?: { author?: { channelId?: unknown } };
}

/** 이 스크립트가 시작하면서 document에 쏘는 이벤트. 먼저 들어와 있던 같은 스크립트가 듣고 물러난다. */
const STARTED = 'cleantube:main-started';

/**
 * 채널 ID는 HTML에 없고 유튜브가 댓글 요소에 달아 둔 JS 객체에만 있다.
 * 그 객체는 페이지와 같은 세계에서만 보여서 이 스크립트만 MAIN 세계에서 돈다.
 * 여기에는 확장기능 API가 없으므로, 읽은 값을 DOM 속성으로 적어 격리 세계 스크립트에 넘긴다.
 */
export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  world: 'MAIN',
  // 격리 세계 스크립트(document_idle)가 첫 요청을 쏘기 전에 듣고 있어야 한다.
  runAt: 'document_start',

  main() {
    // 확장이 업데이트되면 백그라운드가 이 스크립트를 새로 넣는다. 먼저 있던 것은 그때 듣기를 그만둔다.
    // 둘이 같이 들으면 옛 코드도 속성을 적는다. 페이지 세계에는 WXT의 ctx가 없어서 직접 알린다.
    const replaced = new AbortController();
    document.dispatchEvent(new Event(STARTED));
    document.addEventListener(STARTED, () => replaced.abort(), { signal: replaced.signal });

    // 스스로 DOM을 감시하지 않고 요청받을 때만 적는다. 감시와 스캔 간격은 격리 세계 한 곳에서만 정한다.
    document.addEventListener(
      CHANNEL_ID_REQUEST,
      () => {
        for (const el of document.querySelectorAll<CommentElement>(COMMENT_SELECTOR)) {
          const id = el.commentEntity?.author?.channelId;
          if (typeof id === 'string' && id) {
            if (el.getAttribute(CHANNEL_ID_ATTR) !== id) el.setAttribute(CHANNEL_ID_ATTR, id);
          } else if (el.hasAttribute(CHANNEL_ID_ATTR)) {
            // 유튜브가 요소를 다른 댓글에 재사용했는데 데이터가 아직 없으면 옛 값을 남기지 않는다.
            el.removeAttribute(CHANNEL_ID_ATTR);
          }
        }
      },
      { signal: replaced.signal },
    );
  },
});
