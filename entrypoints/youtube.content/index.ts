import { defineContentScript } from '#imports';
import { DEFAULT_SETTINGS, settingsItem, type Settings } from '@/utils/settings';
import { findChannel, findKeyword } from '@/utils/matcher';
import './style.css';

/**
 * 숨김 대상 요소에 붙이는 속성. 값은 'hide' | 'blur'.
 * 실제 숨김은 style.css가 이 속성을 보고 처리한다.
 * DOM을 지우지 않고 속성만 토글하므로 설정을 바꾸면 되돌릴 수 있다.
 */
const ATTR = 'data-cleantube';
const REASON_ATTR = 'data-cleantube-reason';

/** 영상 카드 컨테이너. 유튜브는 화면마다 다른 커스텀 엘리먼트를 쓴다. */
const VIDEO_SELECTOR = [
  'ytd-rich-item-renderer', // 홈, 구독 피드 그리드
  'ytd-video-renderer', // 검색 결과
  'ytd-compact-video-renderer', // 재생 페이지 오른쪽 추천
  'ytd-grid-video-renderer', // 채널 페이지 (구형)
  'ytd-playlist-video-renderer', // 재생목록
  'yt-lockup-view-model', // 신형 카드 (점진 적용 중)
].join(',');

/** 영상 카드 안에서 제목을 찾는 순서 */
const TITLE_SELECTORS = ['#video-title', '.yt-lockup-metadata-view-model__title', 'h3'];

/** 영상 카드 안에서 채널명을 찾는 순서 */
const CHANNEL_SELECTORS = [
  'ytd-channel-name #text',
  '#channel-name #text',
  '.yt-content-metadata-view-model__metadata-text',
];

/** 개별 댓글. 최상위 댓글과 답글 모두 해당. */
const COMMENT_SELECTOR = 'ytd-comment-view-model, ytd-comment-renderer';

/** 쇼츠 선반 (홈·구독 피드에 가로로 늘어선 쇼츠 묶음) */
const SHORTS_SHELF_SELECTOR = 'ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts]';

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  runAt: 'document_idle',

  async main(ctx) {
    let settings: Settings = await settingsItem.getValue();

    // ---- 스캔 스케줄링: DOM 변경이 몰려와도 150ms에 한 번만 돈다 ----
    let timer: number | undefined;
    const schedule = () => {
      if (timer !== undefined) return;
      timer = ctx.setTimeout(() => {
        timer = undefined;
        applyAll();
      }, 150);
    };

    // 유튜브는 SPA라 페이지 이동 시 스크립트가 다시 실행되지 않는다.
    // 대신 DOM 변경을 감시해서 새 카드가 붙을 때마다 스캔한다.
    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());

    // 유튜브가 페이지 이동을 끝냈을 때 쏘는 자체 이벤트
    ctx.addEventListener(document, 'yt-navigate-finish', schedule);

    // 팝업이나 옵션에서 설정을 바꾸면 즉시 반영
    const unwatch = settingsItem.watch((next) => {
      settings = next ?? DEFAULT_SETTINGS;
      applyAll();
    });
    ctx.onInvalidated(unwatch);

    applyAll();

    // ---- 실제 처리 ----

    function applyAll() {
      if (!settings.enabled) {
        clearAll();
        return;
      }
      processVideos();
      processShortsShelves();
      processComments();
    }

    function processVideos() {
      // 신형 카드(yt-lockup-view-model)가 ytd-rich-item-renderer 안에 들어있는 경우가 있다.
      // 바깥 컨테이너를 숨겨야 그리드에 빈 칸이 남지 않으므로 컨테이너 기준으로 중복 제거한다.
      const containers = new Set<HTMLElement>();
      for (const el of document.querySelectorAll<HTMLElement>(VIDEO_SELECTOR)) {
        containers.add(el.closest<HTMLElement>('ytd-rich-item-renderer') ?? el);
      }
      for (const el of containers) mark(el, evaluateVideo(el));
    }

    function evaluateVideo(el: HTMLElement): string | null {
      if (settings.hideShorts && isShorts(el)) return 'shorts';

      const title = firstText(el, TITLE_SELECTORS);
      const keyword = findKeyword(title, settings.keywords);
      if (keyword) return `keyword:${keyword}`;

      const channel = findChannel(channelIds(el), settings.channels);
      if (channel) return `channel:${channel}`;

      return null;
    }

    function processShortsShelves() {
      for (const el of document.querySelectorAll<HTMLElement>(SHORTS_SHELF_SELECTOR)) {
        const target = el.closest<HTMLElement>('ytd-rich-section-renderer') ?? el;
        mark(target, settings.hideShorts ? 'shorts' : null);
      }
    }

    function processComments() {
      const section = document.querySelector<HTMLElement>('ytd-comments');
      if (section) mark(section, settings.hideAllComments ? 'all-comments' : null);
      if (settings.hideAllComments) return;

      for (const el of document.querySelectorAll<HTMLElement>(COMMENT_SELECTOR)) {
        mark(el, evaluateComment(el));
      }
    }

    function evaluateComment(el: HTMLElement): string | null {
      const text = firstText(el, ['#content-text']);
      const keyword = findKeyword(text, settings.keywords);
      if (keyword) return `keyword:${keyword}`;

      // 댓글 작성자는 "@핸들" 형태로 나온다
      const author = firstText(el, ['#author-text']);
      const channel = findChannel([author], settings.channels);
      if (channel) return `channel:${channel}`;

      return null;
    }

    function mark(el: HTMLElement, reason: string | null) {
      if (reason) {
        if (el.getAttribute(ATTR) !== settings.mode) el.setAttribute(ATTR, settings.mode);
        if (el.getAttribute(REASON_ATTR) !== reason) el.setAttribute(REASON_ATTR, reason);
      } else if (el.hasAttribute(ATTR)) {
        el.removeAttribute(ATTR);
        el.removeAttribute(REASON_ATTR);
      }
    }

    function clearAll() {
      for (const el of document.querySelectorAll(`[${ATTR}]`)) {
        el.removeAttribute(ATTR);
        el.removeAttribute(REASON_ATTR);
      }
    }
  },
});

// ---- DOM 헬퍼 ----

/** 셀렉터를 순서대로 시도해서 처음 찾은 요소의 텍스트를 돌려준다 */
function firstText(root: Element, selectors: readonly string[]): string {
  for (const selector of selectors) {
    const text = root.querySelector(selector)?.textContent?.trim();
    if (text) return text;
  }
  return '';
}

/** 카드에서 채널명과 @핸들을 모두 모은다. 사용자가 어느 쪽을 입력해도 매칭되도록. */
function channelIds(root: Element): string[] {
  const ids: string[] = [];

  const name = firstText(root, CHANNEL_SELECTORS);
  if (name) ids.push(name);

  for (const anchor of root.querySelectorAll<HTMLAnchorElement>('a[href*="/@"]')) {
    const handle = anchor.getAttribute('href')?.match(/\/@([^/?#]+)/)?.[1];
    if (handle) ids.push(`@${handle}`);
  }
  return ids;
}

function isShorts(el: Element): boolean {
  return el.querySelector('a[href^="/shorts/"], ytm-shorts-lockup-view-model') !== null;
}
