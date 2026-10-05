import type { DisplayMode } from '@/utils/settings';

/**
 * 완전히 숨길 요소에 붙이는 속성. 값은 걸린 차단 항목의 키라 DevTools에서 왜 숨겨졌는지 바로 보인다.
 * 실제 숨김은 style.css가 이 속성을 보고 처리한다.
 * DOM을 지우지 않고 속성만 토글하므로 목록에서 빼면 되돌아온다.
 */
const BLOCKED_ATTR = 'data-cleantube-blocked';

/** 흐리게 하거나 자리표시자로 바꿀 요소에 붙이는 속성. 값은 'blur' 또는 'placeholder'. 모양은 style.css. */
const COVER_ATTR = 'data-cleantube-cover';

/** 사용자가 "숨긴 항목 보기"를 누른 요소. 가림을 잠깐 푼다. 요소에만 적어 두므로 페이지를 옮기면 사라진다. */
const REVEALED_ATTR = 'data-cleantube-revealed';

/** 가린 요소 안에 우리가 넣는 요소. "차단된 댓글" 글자와 pill이 들어 있다. */
const OVERLAY_ATTR = 'data-cleantube-overlay';

/** 영상 페이지 댓글 영역에서 최상위 댓글 하나와 그 답글 묶음("답글 N개" 버튼, 펼친 답글)을 감싸는 요소. */
const THREAD_SELECTOR = 'ytd-comment-thread-renderer';

/** 스레드 안의 답글 묶음. 이 안에 있는 댓글은 답글이다. */
const REPLIES_SELECTOR = 'ytd-comment-replies-renderer';

/** 사용자가 차단이나 해제를 눌렀을 때 접히고 펼쳐지는 시간. 취향값이라 쓰면서 조정한다. */
const DURATION_MS = 220;

export interface Display {
  /** 걸린 차단 항목의 키. 속성 값으로 적는다. */
  key: string;
  mode: DisplayMode;
}

interface Options {
  /** blur나 placeholder일 때 최상위 댓글의 답글까지 가릴지. */
  coverReplies: boolean;
  /** 사용자가 누른 변경이면 참. 스크롤로 새로 붙은 댓글은 거짓이라 바로 적용된다. */
  animate: boolean;
}

/**
 * 댓글 하나의 표시 상태를 맞춘다. display가 null이면 차단되지 않은 댓글.
 *
 * 무엇을 가리나:
 * - hide: 답글이면 그 답글, 최상위 댓글이면 스레드 전체. 답글 묶음이 댓글 요소의 자식이 아니라 형제라서,
 *   댓글만 숨기면 "답글 N개"와 펼친 답글이 부모 없이 남는다.
 * - blur, placeholder: 부모가 자리에 남으니 그 댓글만 가려도 된다. coverReplies면 스레드 전체.
 */
export function applyDisplay(comment: HTMLElement, display: Display | null, options: Options): void {
  // 스레드의 상태는 그 스레드의 최상위 댓글만 정한다. 답글은 스레드를 건드리지 않는다.
  const thread = comment.closest(REPLIES_SELECTOR)
    ? null
    : comment.closest<HTMLElement>(THREAD_SELECTOR);

  setHidden(thread ?? comment, display?.mode === 'hide' ? display.key : null, options.animate);

  const cover = display && display.mode !== 'hide' ? display.mode : null;
  const coverTarget = thread && options.coverReplies ? thread : comment;
  setCover(comment, coverTarget === comment ? cover : null);
  if (thread) setCover(thread, coverTarget === thread ? cover : null);
}

// --- 완전히 숨김 ---

/** 접히거나 펼쳐지는 중인 요소. 끝나면 desired에 적힌 최신 상태를 적용한다. */
const animating = new WeakSet<Element>();
const desired = new WeakMap<Element, string | null>();

function setHidden(target: HTMLElement, key: string | null, animate: boolean): void {
  if (animating.has(target)) {
    desired.set(target, key);
    return;
  }
  const current = target.getAttribute(BLOCKED_ATTR);
  if (key) {
    if (current === key) return;
    if (current === null && animate) void collapse(target, key);
    else target.setAttribute(BLOCKED_ATTR, key);
  } else if (current !== null) {
    if (animate) void expand(target);
    else target.removeAttribute(BLOCKED_ATTR);
  }
}

async function collapse(target: HTMLElement, key: string) {
  animating.add(target);
  desired.set(target, key);
  // forwards로 접힌 상태를 붙잡아 두고 속성을 붙인 뒤에 푼다. 사이에 한 프레임이라도 원래 크기로 돌아오지 않게.
  const animation = target.animate([measure(target), COLLAPSED], {
    duration: DURATION_MS,
    easing: 'ease-in',
    fill: 'forwards',
  });
  await settled(animation);
  applyDesired(target);
  animation.cancel();
}

async function expand(target: HTMLElement) {
  animating.add(target);
  desired.set(target, null);
  target.removeAttribute(BLOCKED_ATTR);
  const animation = target.animate([COLLAPSED, measure(target)], {
    duration: DURATION_MS,
    easing: 'ease-out',
  });
  await settled(animation);
  applyDesired(target);
}

/** 애니메이션 도중에 바뀐 요청이 있으면 그 최신 상태로 맞춘다. */
function applyDesired(target: HTMLElement) {
  const key = desired.get(target) ?? null;
  if (key) target.setAttribute(BLOCKED_ATTR, key);
  else target.removeAttribute(BLOCKED_ATTR);
  animating.delete(target);
  desired.delete(target);
}

async function settled(animation: Animation) {
  try {
    await animation.finished;
  } catch {
    // 취소돼도 최종 상태는 적용한다
  }
}

const COLLAPSED: Keyframe = {
  opacity: 0,
  height: '0px',
  marginTop: '0px',
  marginBottom: '0px',
  paddingTop: '0px',
  paddingBottom: '0px',
  overflow: 'hidden',
};

function measure(el: HTMLElement): Keyframe {
  const s = getComputedStyle(el);
  return {
    opacity: 1,
    height: s.height,
    marginTop: s.marginTop,
    marginBottom: s.marginBottom,
    paddingTop: s.paddingTop,
    paddingBottom: s.paddingBottom,
    overflow: 'hidden',
  };
}

// --- 블러, 자리표시자 ---

function setCover(target: HTMLElement, mode: 'blur' | 'placeholder' | null): void {
  const current = target.getAttribute(COVER_ATTR);
  if (!mode) {
    // 가림막은 속성과 함께 넣고 함께 뺀다. 속성이 없으면 가림막도 없으니 찾지 않는다.
    if (current === null) return;
    target.removeAttribute(COVER_ATTR);
    target.removeAttribute(REVEALED_ATTR);
    overlayOf(target)?.remove();
    return;
  }
  if (current !== mode) target.setAttribute(COVER_ATTR, mode);
  // 유튜브가 요소를 다시 그리면서 가림막을 떨어뜨렸을 수 있다
  if (!overlayOf(target)) target.prepend(createOverlay(target));
}

function overlayOf(target: HTMLElement): Element | null {
  return target.querySelector(`:scope > [${OVERLAY_ATTR}]`);
}

function createOverlay(target: HTMLElement): HTMLElement {
  const overlay = document.createElement('div');
  overlay.setAttribute(OVERLAY_ATTR, '');

  const label = document.createElement('span');
  label.textContent = '차단된 댓글';

  const pill = document.createElement('button');
  pill.type = 'button';
  pill.textContent = '숨긴 항목 보기';
  pill.addEventListener('click', (e) => {
    e.stopPropagation();
    const revealed = target.toggleAttribute(REVEALED_ATTR);
    pill.textContent = revealed ? '다시 가리기' : '숨긴 항목 보기';
  });

  overlay.append(label, pill);
  return overlay;
}
