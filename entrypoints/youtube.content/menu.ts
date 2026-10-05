import { createShadowRootUi, type ContentScriptContext } from '#imports';
import type { Author } from '@/utils/matcher';
import css from './menu.css?inline';

export interface MenuItem {
  label: string;
  run(author: Author): void;
}

export interface CommentMenu {
  /** 댓글에 메뉴 버튼이 없으면 붙인다. 유튜브가 댓글을 다시 그리면 버튼이 사라질 수 있어서 스캔할 때마다 부른다. */
  attach(comment: HTMLElement): void;
  remove(): void;
}

/** 댓글 오른쪽, 유튜브가 ⋮ 메뉴를 두는 자리. 로그아웃이면 유튜브 버튼은 hidden이고 자리만 남아 있다. */
const SLOT_SELECTOR = '#body > #action-menu';

/** 버튼 모양은 style.css(페이지에 적용)에 있다. 댓글에 마우스를 올렸을 때만 보이게 하려면 페이지 CSS여야 해서. */
const TRIGGER_ATTR = 'data-cleantube-trigger';

// 세로 점 셋은 유튜브 ⋮와 헷갈려서 다른 모양을 쓴다
const ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6.5 6.5l11 11" stroke="currentColor" stroke-width="2"/></svg>`;

/**
 * 댓글마다 버튼 하나, 드롭다운은 페이지에 하나(유튜브 메뉴와 같은 방식).
 * 유튜브의 ⋮ 메뉴에 항목을 끼우지 않는다. 로그아웃이면 그 메뉴가 없고, 로그인이어도 공용 팝업에 매번 다시 그려져서
 * 끼운 항목을 유지하기 어렵다. 우리 버튼과 메뉴는 로그인 여부와 무관하게 같은 코드로 동작한다.
 */
export async function createCommentMenu(
  ctx: ContentScriptContext,
  items: readonly MenuItem[],
  readAuthor: (comment: HTMLElement) => Author,
): Promise<CommentMenu> {
  let root: HTMLElement | undefined;
  let openTrigger: HTMLButtonElement | undefined;

  const ui = await createShadowRootUi(ctx, {
    name: 'cleantube-menu',
    position: 'inline',
    css,
    onMount(container) {
      root = document.createElement('div');
      root.className = 'menu';
      root.setAttribute('role', 'menu');
      root.hidden = true;
      container.append(root);
    },
    onRemove() {
      root = undefined;
      openTrigger = undefined;
    },
  });
  ui.mount();

  // 메뉴 밖을 누르거나, Esc, 스크롤, 페이지 이동이면 닫는다. 유튜브 메뉴와 같은 감각.
  ctx.addEventListener(
    document,
    'pointerdown',
    (e) => {
      if (!openTrigger || !root) return;
      const path = e.composedPath();
      if (!path.includes(root) && !path.includes(openTrigger)) close();
    },
    { capture: true },
  );
  ctx.addEventListener(document, 'keydown', (e) => {
    if (e.key === 'Escape') close();
  });
  ctx.addEventListener(window, 'scroll', close, { capture: true, passive: true });
  ctx.addEventListener(window, 'wxt:locationchange', close);

  return {
    attach(comment) {
      const slot = comment.querySelector(SLOT_SELECTOR);
      if (!slot || slot.querySelector(`[${TRIGGER_ATTR}]`)) return;
      // 유튜브 ⋮의 왼쪽에 둔다. 나란히 놓는 배치는 style.css.
      slot.prepend(createTrigger(comment));
    },
    remove: ui.remove,
  };

  function createTrigger(comment: HTMLElement): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute(TRIGGER_ATTR, '');
    button.setAttribute('aria-label', 'CleanTube 메뉴');
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = ICON;
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      if (openTrigger === button) close();
      else open(button, comment);
    });
    return button;
  }

  function open(trigger: HTMLButtonElement, comment: HTMLElement) {
    if (!root) return;
    close();
    const author = readAuthor(comment);

    root.replaceChildren();
    // 유튜브는 <html dark>로 테마를 표시한다. Shadow DOM 안에서는 CSS로 못 보니 열 때마다 읽는다.
    root.classList.toggle('dark', document.documentElement.hasAttribute('dark'));
    const who = document.createElement('div');
    who.className = 'who';
    who.textContent = author.handle ?? author.channelId ?? '작성자를 못 읽음';
    root.append(who);
    for (const item of items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'menuitem');
      button.textContent = item.label;
      button.disabled = !author.handle && !author.channelId;
      button.addEventListener('click', () => {
        close();
        item.run(author);
      });
      root.append(button);
    }

    root.hidden = false;
    position(root, trigger);
    trigger.setAttribute('aria-expanded', 'true');
    openTrigger = trigger;
    root.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }

  function close() {
    if (!root || !openTrigger) return;
    root.hidden = true;
    openTrigger.setAttribute('aria-expanded', 'false');
    openTrigger = undefined;
  }
}

/** 버튼의 오른쪽 끝에 맞춰 아래로 연다. 아래 공간이 모자라면 위로. */
function position(menu: HTMLElement, trigger: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  const gap = 4;
  menu.style.right = `${document.documentElement.clientWidth - rect.right}px`;
  menu.style.left = 'auto';
  if (rect.bottom + gap + menu.offsetHeight <= window.innerHeight) {
    menu.style.top = `${rect.bottom + gap}px`;
    menu.style.bottom = 'auto';
  } else {
    menu.style.top = 'auto';
    menu.style.bottom = `${window.innerHeight - rect.top + gap}px`;
  }
}
