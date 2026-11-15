import { browser, defineContentScript } from '#imports';
import { blockAuthor, loadBlocked, removeBlock, unblockAuthor, watchBlocked } from '@/utils/blocklist';
import { formatDuration } from '@/utils/duration';
import { messagesFor, resolveLocale, type Locale, type Messages } from '@/utils/i18n';
import { entryKey, findBlock, type Author, type BlockEntry } from '@/utils/matcher';
import { loadSettings, watchSettings, type Settings } from '@/utils/settings';
import { CHANNEL_ID_ATTR, CHANNEL_ID_REQUEST, COMMENT_SELECTOR } from '@/utils/youtube';
import { OVERLAY_ATTR, applyDisplay, clearDisplay } from './display';
import { MENU_HOST, TRIGGER_ATTR, createCommentMenu, type MenuItem } from './menu';
import { PANEL_HOST, createPanel, type Panel, type PanelRow } from './panel';
import { readSource } from './source';
import './style.css';

/** setTimeout이 받을 수 있는 가장 긴 지연. 약 24.8일. 넘으면 바로 실행돼 버린다. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  runAt: 'document_idle',

  async main(ctx) {
    let settings: Settings = await loadSettings();
    let blocked: BlockEntry[] = await loadBlocked();
    // 메뉴, 가림막, 패널의 언어. 설정이 바뀌면 아래 watch에서 다시 고른다
    const uiLanguage = browser.i18n.getUILanguage();
    let locale: Locale = resolveLocale(settings.language, uiLanguage);
    let t: Messages = messagesFor(locale);
    let rows: PanelRow[] = [];
    let panel: Panel | undefined;
    let panelMounting = false;
    // 아래 함수들이 쓰는 변수는 여기 위쪽에 모아 둔다. 함수는 끌어올려져서 먼저 불릴 수 있지만
    // let은 그 줄이 실행되기 전에 건드리면 오류가 난다.
    let expiryTimer: number | undefined;

    // 댓글마다 붙는 메뉴. 항목은 아래 menuItems()에 한 줄씩 추가한다.
    const menu = await createCommentMenu(ctx, menuItems, readAuthor, () => ({ ...t.youtube, lang: locale }));

    // DOM 변경이 몰려와도 150ms에 한 번만 스캔한다. 새로 붙은 댓글은 아래 콜백이 바로 처리하므로 이 스캔은 안전망이다.
    // 실측(2026-10-06)에서 간격은 0~500ms 어디든 비용이 같았고, 150ms는 페이지 로드 직후의 몰림만 걸러 준다. docs/decisions.md 참고.
    let timer: number | undefined;
    const schedule = () => {
      if (timer !== undefined) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        applyAll();
      }, 150);
    };
    // ctx.setTimeout은 부를 때마다 정리할 리스너를 하나씩 달고 떼지 않는다(WXT 0.21). 스캔은 탭이 열려 있는 내내 걸리므로
    // 그냥 setTimeout을 쓰고 여기서 한 번에 치운다.
    ctx.onInvalidated(() => {
      clearTimeout(timer);
      clearTimeout(expiryTimer);
    });

    // 유튜브는 SPA라 페이지를 옮겨도 스크립트가 다시 실행되지 않는다.
    // 댓글은 스크롤해야 뒤늦게 붙기도 한다. 그래서 DOM 변경을 감시해서 그때마다 스캔한다.
    // 패널과 메뉴는 Shadow DOM 안에 그리므로 다시 그려도 이 감시에 잡히지 않는다.
    const observer = new MutationObserver((records) => {
      // 확장이 꺼지거나 지워진 것은 아무도 알려 주지 않는다. isInvalid를 읽어야 알게 되고, 그때 아래 onInvalidated가 돈다.
      // 끊긴 채로 계속 돌면 옛 목록으로 가리고, 떼 줄 것이 없는 가림이 남는다.
      if (ctx.isInvalid) return;
      // 새로 붙은 댓글과 다른 사람의 댓글이 된 요소는 여기서 바로 처리한다. 이 콜백은 DOM이 바뀐 직후, 화면에 칠하기 전에 돌아서
      // 이미 차단된 작성자의 댓글이 한 번도 보이지 않는다. 나머지는 묶어서 스캔한다.
      const changed = changedComments(records);
      if (changed.size > 0) {
        requestChannelIds();
        const now = Date.now();
        for (const el of changed) applyOne(el, now, false);
      }
      // 스캔이 메뉴 버튼과 가림막을 넣으면 그것도 DOM 변경이라 여기로 돌아온다. 그때마다 스캔을 걸면
      // 스캔이 스캔을 부른다. 우리 요소만 바뀐 변경에는 다시 볼 것이 없다. href가 바뀐 것은 위에서 다 봤다.
      if (records.some((record) => record.type === 'childList' && !isOwnChange(record))) schedule();
    });
    // href는 댓글 요소가 다른 댓글에 다시 쓰이는 것을 알려고 본다. changedComments() 참고.
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href'],
    });
    // 확장이 꺼지거나 업데이트되면 이 스크립트는 끊겨서 저장소를 더 듣지 못한다. 붙여 둔 가림을 그대로 두면 해제해도 풀리지 않는다.
    // 업데이트면 백그라운드가 새 스크립트를 넣고, 그것이 처음부터 다시 가린다.
    ctx.onInvalidated(() => {
      observer.disconnect();
      clearDisplay();
    });

    // 구독은 이 스크립트가 끊길 때 푼다. 확장이 꺼지거나 업데이트돼서 끊긴 것이면 저장소 API가 이미 없어서 풀다가 오류가 난다.
    // 그때는 알림도 더 오지 않으니 넘어간다.
    const untilInvalidated = (unwatch: () => void) =>
      ctx.onInvalidated(() => {
        try {
          unwatch();
        } catch {
          // 풀 것이 없다
        }
      });

    // 차단 목록 페이지, 패널, 메뉴 어디서 바꾸든 storage를 거쳐 여기로 온다. 사용자가 누른 변경이라 애니메이션을 켠다.
    untilInvalidated(
      watchBlocked((next) => {
        blocked = next;
        applyAll(true);
        scheduleExpiry();
      }),
    );
    untilInvalidated(
      watchSettings((next) => {
        const languageChanged = next.language !== settings.language;
        settings = next;
        locale = resolveLocale(settings.language, uiLanguage);
        t = messagesFor(locale);
        // 차단 기능을 켜고 껐거나 표시 방법이 바뀌었을 수 있다. 언어가 바뀌었으면 이미 붙은 가림막과 메뉴 버튼의 글도 여기서 바뀐다
        applyAll(true);
        if (languageChanged) panel?.redraw();
        void syncPanel();
      }),
    );

    applyAll();
    scheduleExpiry();
    void syncPanel();

    function applyAll(animate = false) {
      requestChannelIds();
      const now = Date.now();
      rows = [];
      for (const el of document.querySelectorAll<HTMLElement>(COMMENT_SELECTOR)) {
        rows.push(applyOne(el, now, animate));
      }
      panel?.render(rows);
    }

    // 차단 기능을 꺼 두어도 매칭은 한다. 디버그 패널은 꺼져 있을 때도 어느 댓글이 걸리는지 보여 준다.
    function applyOne(el: HTMLElement, now: number, animate: boolean): PanelRow {
      const author = readAuthor(el);
      const hit = findBlock(author, blocked, now);
      const display =
        settings.enabled && hit
          ? {
              key: entryKey(hit),
              mode: hit.until === undefined ? settings.display.permanent : settings.display.temporary,
            }
          : null;
      applyDisplay(el, display, { coverReplies: settings.coverReplies, animate, text: t.overlay, lang: locale });
      if (settings.enabled) menu.attach(el);
      else menu.detach(el);
      return { author, hit, comment: el };
    }

    // 채널 ID는 페이지 세계에서만 읽을 수 있어서 youtube-main 스크립트에 적어 달라고 요청한다.
    // dispatchEvent는 듣는 쪽이 끝나야 돌아오므로 돌아온 뒤에는 속성이 최신이다.
    function requestChannelIds() {
      document.dispatchEvent(new Event(CHANNEL_ID_REQUEST));
    }

    // 가장 먼저 풀리는 임시 차단 시각에 맞춰 다시 스캔한다.
    // 스캔은 DOM이 바뀔 때만 돌아서, 그대로 두면 기간이 끝나도 화면이 바뀔 때까지 가려져 있다.
    function scheduleExpiry() {
      if (expiryTimer !== undefined) clearTimeout(expiryTimer);
      expiryTimer = undefined;
      const now = Date.now();
      const next = Math.min(...blocked.map((e) => e.until ?? Infinity).filter((until) => until > now));
      if (!Number.isFinite(next)) return;
      expiryTimer = window.setTimeout(
        () => {
          expiryTimer = undefined;
          applyAll(true);
          scheduleExpiry();
        },
        Math.min(next - now, MAX_TIMEOUT_MS),
      );
    }

    async function syncPanel() {
      if (settings.debugPanel && !panel) {
        if (panelMounting) return;
        panelMounting = true;
        const created = await createPanel(
          ctx,
          {
            onBlock: (author, comment) => block(author, comment),
            onUnblock: (entry) => void removeBlock(entry),
          },
          () => ({ locale, text: t.youtube.panel }),
        );
        panelMounting = false;
        // 만드는 동안 꺼졌을 수 있다
        if (!settings.debugPanel) {
          created.remove();
          return;
        }
        panel = created;
        panel.render(rows);
      } else if (!settings.debugPanel && panel) {
        panel.remove();
        panel = undefined;
      }
    }

    /**
     * 메뉴를 열 때마다 그 댓글의 차단 상태를 보고 항목을 정한다.
     * 걸려 있는 종류의 자리에는 해제가 온다. 다른 종류는 그대로 남아서, 누르면 그 종류로 바뀐다.
     * 글자와 동작은 열 때 한 쌍으로 정해 둔다. 누를 때 상태를 다시 보면, 메뉴가 열려 있는 사이에
     * 임시 차단이 끝났을 때 "임시 차단 해제"가 차단을 건다.
     * 임시 차단의 기간은 팝업 설정에서 정한다. 얼마 동안인지 누르기 전에 알 수 있게 글자에 적는다.
     */
    function menuItems(author: Author, comment: HTMLElement): MenuItem[] {
      const hit = findBlock(author, blocked, Date.now());
      const permanent = hit !== null && hit.until === undefined;
      const temporary = hit !== null && hit.until !== undefined;
      const durationMs = settings.temporaryDurationMs;
      const unblock = () => void unblockAuthor(author);
      const text = t.youtube;
      return [
        permanent
          ? { label: text.unblockPermanent, run: unblock }
          : { label: text.blockPermanent, run: () => block(author, comment) },
        temporary
          ? { label: text.unblockTemporary, run: unblock }
          : {
              label: text.blockTemporary(formatDuration(durationMs, t.common)),
              run: () => block(author, comment, durationMs),
            },
      ];
    }

    /**
     * comment는 차단을 누른 그 댓글. 어느 영상의 어떤 댓글이었는지를 항목에 같이 남긴다.
     * durationMs가 없으면 영구 차단. 이미 걸린 차단이 있으면 새 항목이 그것을 대신한다. 화면 갱신은 위의 watch가 한다.
     */
    function block(author: Author, comment: HTMLElement, durationMs?: number) {
      if (!author.channelId && !author.handle) return;
      const now = Date.now();
      const entry: BlockEntry = { at: now };
      // 채널 ID는 핸들을 바꿔도 그대로라 있으면 같이 넣는다. 핸들은 목록에 보여 줄 이름이 된다.
      if (author.channelId) entry.channelId = author.channelId;
      if (author.handle) entry.handle = author.handle;
      if (durationMs !== undefined) entry.until = now + durationMs;
      const source = readSource(comment);
      if (source) entry.source = source;
      void blockAuthor(author, entry);
    }
  },
});

/**
 * 영상 페이지 댓글 헤더의 작성자 링크(a#author-text)의 id. 글자는 채널명이 아니라 "@handle"이고 href는 그 채널의 주소다.
 * 인증·크리에이터 배지가 붙은 댓글은 이 링크가 hidden이 되고 배지가 대신 보이지만 글자는 남아 있다.
 */
const AUTHOR_ID = 'author-text';

function readAuthor(comment: HTMLElement): Author {
  return {
    // href의 핸들은 한글·일본어면 %로 인코딩돼 있어 쓰지 않는다.
    handle: comment.querySelector(`#${AUTHOR_ID}`)?.textContent?.trim() || undefined,
    channelId: comment.getAttribute(CHANNEL_ID_ATTR) ?? undefined,
  };
}

/**
 * 이 변경 묶음에서 바로 다시 봐야 할 댓글. 새로 붙은 것과, 그대로 있으면서 다른 사람의 댓글이 된 것.
 * 유튜브는 댓글 정렬을 바꾸면 요소를 그대로 두고 내용만 바꾼다(2026-11-15 실측). 붙는 요소가 없고 작성자 글자도 글자만 바뀌어서
 * childList로는 알 수 없다. 작성자 링크의 href가 같이 바뀌는 것으로 안다. 작성자가 같으면 href가 그대로라 오지 않고, 그때는 다시 볼 것도 없다.
 * 새로 붙은 댓글도 href가 한 번 바뀌므로 Set으로 모아 한 번만 처리한다.
 */
function changedComments(records: MutationRecord[]): Set<HTMLElement> {
  const out = new Set<HTMLElement>();
  for (const record of records) {
    if (record.type === 'attributes') {
      // 감시가 href만 받게 걸려 있다. 유튜브 화면의 다른 링크들도 오므로 작성자 링크만 고른다
      const link = record.target as Element;
      const comment = link.id === AUTHOR_ID ? link.closest<HTMLElement>(COMMENT_SELECTOR) : null;
      if (comment) out.add(comment);
      continue;
    }
    for (const node of record.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.matches(COMMENT_SELECTOR)) out.add(node);
      else for (const comment of node.querySelectorAll<HTMLElement>(COMMENT_SELECTOR)) out.add(comment);
    }
  }
  return out;
}

/** 우리가 페이지에 넣는 요소. 메뉴 버튼과 가림막은 유튜브 댓글 안에, 메뉴와 패널의 호스트는 body에 들어간다. */
const OWN_SELECTOR = `[${TRIGGER_ATTR}], [${OVERLAY_ATTR}], ${MENU_HOST}, ${PANEL_HOST}`;

/** 우리 요소를 넣거나 뺀 변경, 또는 우리 요소 안에서 일어난 변경(가림막 pill의 글자 바꾸기 같은 것)인지. */
function isOwnChange(record: MutationRecord): boolean {
  if (record.target instanceof Element && record.target.closest(OWN_SELECTOR)) return true;
  for (const list of [record.addedNodes, record.removedNodes]) {
    for (const node of list) {
      if (!(node instanceof Element && node.matches(OWN_SELECTOR))) return false;
    }
  }
  return true;
}
