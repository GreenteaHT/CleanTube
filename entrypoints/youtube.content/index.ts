import { defineContentScript } from '#imports';
import { blockAuthor, loadBlocked, removeBlock, unblockAuthor, watchBlocked } from '@/utils/blocklist';
import { formatDuration } from '@/utils/duration';
import { entryKey, findBlock, type Author, type BlockEntry } from '@/utils/matcher';
import { loadSettings, watchSettings, type Settings } from '@/utils/settings';
import { CHANNEL_ID_ATTR, CHANNEL_ID_REQUEST, COMMENT_SELECTOR } from '@/utils/youtube';
import { OVERLAY_ATTR, applyDisplay } from './display';
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
    let rows: PanelRow[] = [];
    let panel: Panel | undefined;
    let panelMounting = false;
    // 아래 함수들이 쓰는 변수는 여기 위쪽에 모아 둔다. 함수는 끌어올려져서 먼저 불릴 수 있지만
    // let은 그 줄이 실행되기 전에 건드리면 오류가 난다.
    let expiryTimer: number | undefined;

    // 댓글마다 붙는 메뉴. 항목은 아래 menuItems()에 한 줄씩 추가한다.
    const menu = await createCommentMenu(ctx, menuItems, readAuthor);

    // DOM 변경이 몰려와도 150ms에 한 번만 스캔한다. 새로 붙은 댓글은 아래 콜백이 바로 처리하므로 이 스캔은 안전망이다.
    // 실측(2026-10-06)에서 간격은 0~500ms 어디든 비용이 같았고, 150ms는 페이지 로드 직후의 몰림만 걸러 준다. docs/decisions.md 참고.
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
    // 패널과 메뉴는 Shadow DOM 안에 그리므로 다시 그려도 이 감시에 잡히지 않는다.
    const observer = new MutationObserver((records) => {
      // 새로 붙은 댓글은 여기서 바로 처리한다. 이 콜백은 DOM이 바뀐 직후, 화면에 칠하기 전에 돌아서
      // 이미 차단된 작성자의 댓글이 한 번도 보이지 않는다. 나머지는 묶어서 스캔한다.
      const added = addedComments(records);
      if (added.length > 0) {
        requestChannelIds();
        const now = Date.now();
        for (const el of added) applyOne(el, now, false);
      }
      // 스캔이 메뉴 버튼과 가림막을 넣으면 그것도 DOM 변경이라 여기로 돌아온다. 그때마다 스캔을 걸면
      // 스캔이 스캔을 부른다. 우리 요소만 바뀐 변경에는 다시 볼 것이 없다.
      if (records.some((record) => !isOwnChange(record))) schedule();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());

    // 차단 목록 페이지, 패널, 메뉴 어디서 바꾸든 storage를 거쳐 여기로 온다. 사용자가 누른 변경이라 애니메이션을 켠다.
    ctx.onInvalidated(
      watchBlocked((next) => {
        blocked = next;
        applyAll(true);
        scheduleExpiry();
      }),
    );
    ctx.onInvalidated(
      watchSettings((next) => {
        settings = next;
        // 표시 방법이 바뀌었을 수 있다
        applyAll(true);
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

    function applyOne(el: HTMLElement, now: number, animate: boolean): PanelRow {
      const author = readAuthor(el);
      const hit = findBlock(author, blocked, now);
      const display = hit && {
        key: entryKey(hit),
        mode: hit.until === undefined ? settings.display.permanent : settings.display.temporary,
      };
      applyDisplay(el, display, { coverReplies: settings.coverReplies, animate });
      menu.attach(el);
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
      expiryTimer = ctx.setTimeout(
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
        const created = await createPanel(ctx, {
          onBlock: (author, comment) => block(author, comment),
          onUnblock: (entry) => void removeBlock(entry),
        });
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
      return [
        permanent
          ? { label: '영구 차단 해제', run: unblock }
          : { label: '영구 차단', run: () => block(author, comment) },
        temporary
          ? { label: '임시 차단 해제', run: unblock }
          : { label: `임시 차단 · ${formatDuration(durationMs)}`, run: () => block(author, comment, durationMs) },
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

function readAuthor(comment: HTMLElement): Author {
  return {
    // 영상 페이지 댓글 헤더의 작성자 링크. 글자는 채널명이 아니라 "@handle"이다.
    // 인증·크리에이터 배지가 붙은 댓글은 이 링크가 hidden이 되고 배지가 대신 보이지만 글자는 남아 있다.
    // href의 핸들은 한글·일본어면 %로 인코딩돼 있어 쓰지 않는다.
    handle: comment.querySelector('#author-text')?.textContent?.trim() || undefined,
    channelId: comment.getAttribute(CHANNEL_ID_ATTR) ?? undefined,
  };
}

function addedComments(records: MutationRecord[]): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.matches(COMMENT_SELECTOR)) out.push(node);
      else out.push(...node.querySelectorAll<HTMLElement>(COMMENT_SELECTOR));
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
