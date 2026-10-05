import { defineContentScript } from '#imports';
import { loadSettings, settingsItem, withDefaults, type Settings } from '@/utils/settings';
import { findAuthor, type Author } from '@/utils/matcher';
import { CHANNEL_ID_ATTR, CHANNEL_ID_REQUEST, COMMENT_SELECTOR } from '@/utils/youtube';
import { hideTargetOf, setHidden } from './hide';
import { createCommentMenu } from './menu';
import { createPanel, type Panel, type PanelRow } from './panel';
import './style.css';

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  runAt: 'document_idle',

  async main(ctx) {
    let settings: Settings = await loadSettings();
    let rows: PanelRow[] = [];
    let panel: Panel | undefined;
    let panelMounting = false;

    // 댓글마다 붙는 메뉴. 항목은 여기에 한 줄씩 추가한다.
    const menu = await createCommentMenu(ctx, [{ label: '이 작성자 숨기기', run: block }], readAuthor);

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
    // 패널과 메뉴는 Shadow DOM 안에 그리므로 다시 그려도 이 감시에 잡히지 않는다.
    const observer = new MutationObserver((records) => {
      // 새로 붙은 댓글은 여기서 바로 처리한다. 이 콜백은 DOM이 바뀐 직후, 화면에 칠하기 전에 돌아서
      // 이미 차단된 작성자의 댓글이 한 번도 보이지 않는다. 나머지는 묶어서 스캔한다.
      const added = addedComments(records);
      if (added.length > 0) {
        requestChannelIds();
        for (const el of added) applyOne(el, false);
      }
      schedule();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());

    // 팝업, 패널, 메뉴 어디서 바꾸든 storage를 거쳐 여기로 온다. 사용자가 누른 변경이라 애니메이션을 켠다.
    const unwatch = settingsItem.watch((next) => {
      settings = withDefaults(next);
      applyAll(true);
      void syncPanel();
    });
    ctx.onInvalidated(unwatch);

    applyAll();
    void syncPanel();

    function applyAll(animate = false) {
      requestChannelIds();
      rows = [];
      for (const el of document.querySelectorAll<HTMLElement>(COMMENT_SELECTOR)) {
        rows.push(applyOne(el, animate));
      }
      panel?.render(rows);
    }

    function applyOne(el: HTMLElement, animate: boolean): PanelRow {
      const author = readAuthor(el);
      const hit = findAuthor(author, settings.blockedAuthors);
      setHidden(hideTargetOf(el), hit, animate);
      menu.attach(el);
      return { author, hit };
    }

    // 채널 ID는 페이지 세계에서만 읽을 수 있어서 youtube-main 스크립트에 적어 달라고 요청한다.
    // dispatchEvent는 듣는 쪽이 끝나야 돌아오므로 돌아온 뒤에는 속성이 최신이다.
    function requestChannelIds() {
      document.dispatchEvent(new Event(CHANNEL_ID_REQUEST));
    }

    async function syncPanel() {
      if (settings.debugPanel && !panel) {
        if (panelMounting) return;
        panelMounting = true;
        const created = await createPanel(ctx, { onBlock: block, onUnblock: unblock });
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

    function block(author: Author) {
      // 채널 ID는 핸들을 바꿔도 그대로라 있으면 그쪽을 넣는다
      const item = author.channelId ?? author.handle;
      if (item) void saveBlocked([...settings.blockedAuthors, item]);
    }

    function unblock(item: string) {
      void saveBlocked(settings.blockedAuthors.filter((x) => x !== item));
    }

    async function saveBlocked(blockedAuthors: string[]) {
      // 팝업이 같은 때 바꾼 다른 필드를 덮어쓰지 않도록 최신 값에 병합한다. useSettings와 같은 방식.
      // 화면 갱신은 위의 watch가 한다.
      await settingsItem.setValue({ ...(await loadSettings()), blockedAuthors });
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
