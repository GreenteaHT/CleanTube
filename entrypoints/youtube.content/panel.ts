import { createShadowRootUi, type ContentScriptContext } from '#imports';
import { entryKey, type Author, type BlockEntry } from '@/utils/matcher';
import css from './panel.css?inline';

/** 패널 한 줄 = 화면의 댓글 하나. */
export interface PanelRow {
  author: Author;
  /** 이 댓글에 걸린 차단 항목. 없으면 차단되지 않은 댓글. */
  hit: BlockEntry | null;
  /** 그 댓글 요소. 여기서 차단하면 어느 댓글이었는지를 같이 남기려고 들고 있다. */
  comment: HTMLElement;
}

/** 패널을 담는 Shadow DOM 호스트의 태그 이름. body에 붙는다. index.ts가 우리 요소를 가려낼 때 쓴다. */
export const PANEL_HOST = 'cleantube-panel';

interface Handlers {
  onBlock(author: Author, comment: HTMLElement): void;
  onUnblock(entry: BlockEntry): void;
}

export interface Panel {
  render(rows: PanelRow[]): void;
  remove(): void;
}

/**
 * 유튜브 화면 오른쪽에 뜨는 디버그 패널. 확장기능이 각 댓글에서 읽은 값과 매칭 결과를 보여 주고,
 * 줄마다 차단/해제 버튼이 있다. 숨겨진 댓글은 display:none이라 댓글 안에 버튼을 둘 수 없어서 패널로 뺐다.
 *
 * React 없이 DOM으로 그린다. 유튜브 모든 페이지에 실리는 스크립트라 React를 넣으면 200KB가 넘게 늘어난다.
 */
export async function createPanel(ctx: ContentScriptContext, handlers: Handlers): Promise<Panel> {
  let rows: PanelRow[] = [];
  let lastKey = '';
  let collapsed = false;
  let root: HTMLElement | undefined;

  const ui = await createShadowRootUi(ctx, {
    name: PANEL_HOST,
    position: 'inline',
    // style.css(댓글 숨김)는 페이지에 적용돼야 해서 cssInjectionMode를 'ui'로 바꿀 수 없다.
    // 그래서 패널 CSS만 문자열로 가져와 Shadow DOM에 넣는다.
    css,
    onMount(container) {
      root = document.createElement('div');
      container.append(root);
      draw();
    },
    onRemove() {
      root = undefined;
    },
  });
  ui.mount();

  return {
    render(next) {
      // 스캔은 자주 돌지만 결과가 같으면 다시 그리지 않는다.
      const key = next
        .map((r) => `${r.author.handle}\0${r.author.channelId}\0${r.hit && entryKey(r.hit)}\0${r.hit?.until}`)
        .join('\n');
      if (key === lastKey) return;
      lastKey = key;
      rows = next;
      draw();
    },
    remove: ui.remove,
  };

  function draw() {
    if (!root) return;
    root.className = collapsed ? 'panel collapsed' : 'panel';
    root.replaceChildren();

    const blockedCount = rows.filter((r) => r.hit).length;
    const toggle = el('button', collapsed ? '펼치기' : '접기');
    toggle.addEventListener('click', () => {
      collapsed = !collapsed;
      draw();
    });
    const header = el('header');
    header.append(el('strong', 'CleanTube'), el('span', `댓글 ${rows.length} · 차단 ${blockedCount}`, 'count'), toggle);
    root.append(header);
    if (collapsed) return;

    if (rows.length === 0) {
      root.append(el('p', '이 페이지에서 읽은 댓글 없음. 댓글이 보일 때까지 스크롤', 'empty'));
      return;
    }
    const list = el('ul');
    for (const row of rows) list.append(renderRow(row));
    root.append(list);
  }

  function renderRow({ author, hit, comment }: PanelRow): HTMLLIElement {
    const info = el('div', undefined, 'info');
    info.append(
      author.handle ? el('div', author.handle, 'handle') : el('div', '핸들을 못 읽음', 'handle missing'),
      author.channelId ? el('div', author.channelId, 'id') : el('div', '채널 ID를 못 읽음', 'id missing'),
    );
    if (hit) info.append(el('div', describe(hit), 'state'));

    // 패널의 차단은 영구 차단. 임시 차단은 댓글 메뉴에서 한다.
    const button = el('button', hit ? '해제' : '차단');
    button.disabled = !hit && !author.channelId && !author.handle;
    button.addEventListener('click', () => (hit ? handlers.onUnblock(hit) : handlers.onBlock(author, comment)));

    const li = el('li', undefined, hit ? 'blocked' : undefined);
    li.append(info, button);
    return li;
  }
}

/** 어느 항목 때문에, 언제까지 차단인지. 채널 ID로 걸렸는지 핸들로 걸렸는지가 보이게 키를 적는다. */
function describe(hit: BlockEntry): string {
  const kind =
    hit.until === undefined
      ? '영구 차단'
      : `${new Date(hit.until).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}까지 차단`;
  return `${kind} · ${entryKey(hit)}`;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
