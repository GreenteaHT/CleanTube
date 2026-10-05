import { createShadowRootUi, type ContentScriptContext } from '#imports';
import type { Author } from '@/utils/matcher';
import css from './panel.css?inline';

/** 패널 한 줄 = 화면의 댓글 하나. */
export interface PanelRow {
  author: Author;
  /** findAuthor 결과. 값이 있으면 그 항목 때문에 숨겨진 상태. */
  hit: string | null;
}

interface Handlers {
  onBlock(author: Author): void;
  onUnblock(item: string): void;
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
    name: 'cleantube-panel',
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
      const key = next.map((r) => `${r.author.handle}\0${r.author.channelId}\0${r.hit}`).join('\n');
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

    const hiddenCount = rows.filter((r) => r.hit).length;
    const toggle = el('button', collapsed ? '펼치기' : '접기');
    toggle.addEventListener('click', () => {
      collapsed = !collapsed;
      draw();
    });
    const header = el('header');
    header.append(el('strong', 'CleanTube'), el('span', `댓글 ${rows.length} · 숨김 ${hiddenCount}`, 'count'), toggle);
    root.append(header);
    if (collapsed) return;

    if (rows.length === 0) {
      root.append(el('p', '이 페이지에서 읽은 댓글이 없어요. 댓글까지 스크롤해 보세요.', 'empty'));
      return;
    }
    const list = el('ul');
    for (const row of rows) list.append(renderRow(row));
    root.append(list);
  }

  function renderRow({ author, hit }: PanelRow): HTMLLIElement {
    const info = el('div', undefined, 'info');
    info.append(
      author.handle ? el('div', author.handle, 'handle') : el('div', '핸들을 못 읽음', 'handle missing'),
      author.channelId ? el('div', author.channelId, 'id') : el('div', '채널 ID를 못 읽음', 'id missing'),
    );
    if (hit) info.append(el('div', `숨김 · 매칭된 항목: ${hit}`, 'state'));

    const button = el('button', hit ? '해제' : '차단');
    button.disabled = !hit && !author.channelId && !author.handle;
    button.addEventListener('click', () => (hit ? handlers.onUnblock(hit) : handlers.onBlock(author)));

    const li = el('li', undefined, hit ? 'blocked' : undefined);
    li.append(info, button);
    return li;
  }
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
