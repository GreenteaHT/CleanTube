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
export const OVERLAY_ATTR = 'data-cleantube-overlay';

/** 영상 페이지 댓글 영역에서 최상위 댓글 하나와 그 답글 묶음("답글 N개" 버튼, 펼친 답글)을 감싸는 요소. */
const THREAD_SELECTOR = 'ytd-comment-thread-renderer';

/** 스레드 안의 답글 묶음. 이 안에 있는 댓글은 답글이다. */
const REPLIES_SELECTOR = 'ytd-comment-replies-renderer';

/** 사용자가 차단이나 해제를 눌렀을 때 표시가 바뀌는 데 걸리는 시간. 취향값이라 쓰면서 조정한다. */
const DURATION_MS = 220;

type Cover = Exclude<DisplayMode, 'hide'>;

export interface Display {
  /** 걸린 차단 항목의 키. 속성 값으로 적는다. */
  key: string;
  mode: DisplayMode;
}

/** 가림막의 글. 화면 언어를 따른다(locales/의 overlay). */
export interface OverlayText {
  /** "차단된 댓글" */
  blocked: string;
  /** 가려져 있을 때의 pill. "숨긴 항목 보기" */
  show: string;
  /** 열어 봤을 때의 pill. "다시 가리기" */
  hide: string;
}

interface Options {
  /** blur나 placeholder일 때 최상위 댓글의 답글까지 가릴지. */
  coverReplies: boolean;
  /** 사용자가 누른 변경이면 참. 스크롤로 새로 붙은 댓글은 거짓이라 바로 적용된다. */
  animate: boolean;
  text: OverlayText;
  /** 화면 언어. 가림막에 lang으로 달아 브라우저가 그 언어의 글꼴로 그리게 한다(유튜브 페이지의 언어와 다를 수 있다) */
  lang: string;
}

/**
 * 가림막에 쓸 글. 부를 때마다 받은 것으로 바꾼다. pill을 누를 때도 그때의 글을 써야 해서 모듈에 들고 있다.
 * applyDisplay가 가림막을 만들기 전에 늘 먼저 채운다.
 */
let overlayText: OverlayText;
let overlayLang: string;

/**
 * 댓글 하나의 표시 상태를 맞춘다. display가 null이면 차단되지 않은 댓글.
 *
 * 무엇을 가리나:
 * - hide: 답글이면 그 답글, 최상위 댓글이면 스레드 전체. 답글 묶음이 댓글 요소의 자식이 아니라 형제라서,
 *   댓글만 숨기면 "답글 N개"와 펼친 답글이 부모 없이 남는다.
 * - blur, placeholder: 부모가 자리에 남으니 그 댓글만 가려도 된다. coverReplies면 스레드 전체.
 */
export function applyDisplay(comment: HTMLElement, display: Display | null, options: Options): void {
  overlayText = options.text;
  overlayLang = options.lang;
  // 스레드의 상태는 그 스레드의 최상위 댓글만 정한다. 답글은 스레드를 건드리지 않는다.
  const thread = comment.closest(REPLIES_SELECTOR)
    ? null
    : comment.closest<HTMLElement>(THREAD_SELECTOR);
  const hideTarget = thread ?? comment;
  const hideKey = display?.mode === 'hide' ? display.key : null;
  const cover = display && display.mode !== 'hide' ? display.mode : null;
  const coverTarget = thread && options.coverReplies ? thread : comment;

  // 숨겨진 요소의 가림은 보이지 않으니 움직이지 않고 바로 바꾼다.
  const animateCover = options.animate && hideKey === null && !hideTarget.hasAttribute(BLOCKED_ATTR);

  // 접힐 때는 가려진 모습 그대로 접히게 숨김을 먼저 맞추고,
  // 펼칠 때는 펼친 끝 크기에 가림막이 들어가 있게 가림을 먼저 맞춘다.
  if (hideKey !== null) setHidden(hideTarget, hideKey, options.animate);
  setCover(comment, coverTarget === comment ? cover : null, animateCover);
  if (thread) setCover(thread, coverTarget === thread ? cover : null, animateCover);
  if (hideKey === null) setHidden(hideTarget, null, options.animate);
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
  const animation = target.animate([measure(target), COLLAPSED], { ...timing(true), fill: 'forwards' });
  await settled(animation);
  applyDesired(target);
  animation.cancel();
}

async function expand(target: HTMLElement) {
  animating.add(target);
  desired.set(target, null);
  target.removeAttribute(BLOCKED_ATTR);
  const animation = target.animate([COLLAPSED, measure(target)], timing(false));
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

// --- 블러, 자리표시자 ---

/** 가림이 바뀌는 중인 요소의 애니메이션. 끝나기 전에 또 바뀌면 멈추고 그 자리에서 이어 간다. */
const coverAnimations = new WeakMap<Element, Animation[]>();

function setCover(target: HTMLElement, mode: Cover | null, animate: boolean): void {
  const current = target.getAttribute(COVER_ATTR);
  if (current === mode) {
    if (mode === null) return;
    // 유튜브가 요소를 다시 그리면서 가림막을 떨어뜨렸을 수 있다. 있으면 언어가 바뀌었을 수 있어서 글만 맞춘다
    const overlay = overlayOf(target);
    if (!overlay) target.prepend(createOverlay(target));
    else labelOverlay(overlay, target);
    return;
  }
  change(target, animate, mode !== null, () => {
    if (mode === null) {
      // 가림막은 속성과 함께 넣고 함께 뺀다
      target.removeAttribute(COVER_ATTR);
      target.removeAttribute(REVEALED_ATTR);
      overlayOf(target)?.remove();
    } else {
      target.setAttribute(COVER_ATTR, mode);
      if (!overlayOf(target)) target.prepend(createOverlay(target));
    }
  });
}

/** mutate()로 DOM을 바꾸고, animate면 바꾸기 전후를 재서 달라진 것을 움직인다. */
function change(target: HTMLElement, animate: boolean, covering: boolean, mutate: () => void): void {
  // 움직이는 도중이면 멈추기 전에 재서 지금 보이는 값에서 이어 간다
  const before = animate ? snapshot(target) : null;
  coverAnimations.get(target)?.forEach((animation) => animation.cancel());
  mutate();
  if (before) coverAnimations.set(target, transition(before, snapshot(target), timing(covering)));
}

interface Shot {
  rect: DOMRect;
  style: Keyframe;
}

type Snapshot = Map<Element, Shot>;

/**
 * 요소 자신과 자식들(내용, 가림막)의 자리와 값. 요소 자신은 높이도 잰다.
 * 가림이 바뀌기 전후로 재서 달라진 것만 움직이면, 흐리게·자리표시자·"숨긴 항목 보기"와 그 사이의 전환을 따로 적지 않아도 된다.
 */
function snapshot(target: HTMLElement): Snapshot {
  const shots: Snapshot = new Map();
  const shoot = (el: Element, style: Keyframe) => shots.set(el, { rect: el.getBoundingClientRect(), style });
  shoot(target, { ...paint(target), ...measure(target) });
  for (const child of target.children) shoot(child, paint(child));
  return shots;
}

/** 자리를 옮길 때 원래 transform 위에 얹으려고 그것도 같이 읽는다. */
function paint(el: Element): Keyframe {
  const s = getComputedStyle(el);
  return { opacity: s.opacity, filter: s.filter, transform: s.transform };
}

/** 전후가 다른 요소만 그 사이를 움직인다. 속성을 바꾼 뒤에 재므로 끝나면 CSS가 정한 값이 그대로 이어진다. */
function transition(before: Snapshot, after: Snapshot, options: KeyframeAnimationOptions): Animation[] {
  const animations: Animation[] = [];
  for (const [el, to] of after) {
    if (!visible(to.rect)) continue;
    let start: Keyframe;
    let end: Keyframe;
    const from = before.get(el);
    if (!from || appears(el, from, to)) {
      start = { opacity: '0' };
      end = { opacity: to.style.opacity };
    } else {
      start = { ...from.style };
      end = { ...to.style };
      // 자리가 바뀐 것은 원래 자리에서 새 자리로 옮겨 간다
      const dx = from.rect.left - to.rect.left;
      const dy = from.rect.top - to.rect.top;
      if (dx || dy) start.transform = `translate(${dx}px, ${dy}px) ${end.transform === 'none' ? '' : end.transform}`;
    }
    if (Object.keys(end).every((prop) => start[prop] === end[prop])) continue;
    animations.push(el.animate([start, end], options));
  }
  return animations;
}

/** 옮겨 가는 대신 투명한 데서 나타날 것. 새로 보이는 것과, 모양이 통째로 바뀌는 가림막. */
function appears(el: Element, from: Shot, to: Shot): boolean {
  if (!visible(from.rect)) return true;
  // 흐리게의 가림막은 댓글을 덮는 판이었다가 열면 맨 위 한 줄이 된다. 그 안의 pill이 가운데와 윗줄 사이를 오가지 않게 한다.
  return el.hasAttribute(OVERLAY_ATTR) && (from.rect.width !== to.rect.width || from.rect.height !== to.rect.height);
}

function visible(rect: DOMRect): boolean {
  return rect.width > 0 && rect.height > 0;
}

function overlayOf(target: HTMLElement): Element | null {
  return target.querySelector(`:scope > [${OVERLAY_ATTR}]`);
}

function createOverlay(target: HTMLElement): HTMLElement {
  const overlay = document.createElement('div');
  overlay.setAttribute(OVERLAY_ATTR, '');

  const label = document.createElement('span');
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.addEventListener('click', (e) => {
    e.stopPropagation();
    const revealing = !target.hasAttribute(REVEALED_ATTR);
    change(target, true, !revealing, () => {
      target.toggleAttribute(REVEALED_ATTR, revealing);
      labelOverlay(overlay, target);
    });
  });

  overlay.append(label, pill);
  labelOverlay(overlay, target);
  return overlay;
}

/** 가림막의 글을 지금 언어와 열림 상태에 맞춘다. 같으면 건드리지 않는다. 바꿀 때마다 DOM 변경이 생겨서. */
function labelOverlay(overlay: Element, target: HTMLElement) {
  const [label, pill] = overlay.children;
  const pillText = target.hasAttribute(REVEALED_ATTR) ? overlayText.hide : overlayText.show;
  if (overlay.getAttribute('lang') !== overlayLang) overlay.setAttribute('lang', overlayLang);
  if (label && label.textContent !== overlayText.blocked) label.textContent = overlayText.blocked;
  if (pill && pill.textContent !== pillText) pill.textContent = pillText;
}

// --- 숨김과 가림이 같이 쓰는 것 ---

/** 가릴 때는 ease-in, 풀 때는 ease-out. 세 표시 방법이 같은 리듬으로 움직이게. */
function timing(covering: boolean): KeyframeAnimationOptions {
  return { duration: DURATION_MS, easing: covering ? 'ease-in' : 'ease-out' };
}

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
