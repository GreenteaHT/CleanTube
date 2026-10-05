/**
 * 숨길 요소에 붙이는 속성. 값은 매칭된 차단 목록 항목이라 DevTools에서 왜 숨겨졌는지 바로 보인다.
 * 실제 숨김은 style.css가 이 속성을 보고 처리한다.
 * DOM을 지우지 않고 속성만 토글하므로 목록에서 빼면 되돌아온다.
 */
export const BLOCKED_ATTR = 'data-cleantube-blocked';

/** 영상 페이지 댓글 영역에서 최상위 댓글 하나와 그 답글 묶음("답글 N개" 버튼, 펼친 답글)을 감싸는 요소. */
const THREAD_SELECTOR = 'ytd-comment-thread-renderer';

/** 스레드 안의 답글 묶음. 이 안에 있는 댓글은 답글이다. */
const REPLIES_SELECTOR = 'ytd-comment-replies-renderer';

/** 사용자가 차단이나 해제를 눌렀을 때 접히고 펼쳐지는 시간. 취향값이라 쓰면서 조정한다. */
const DURATION_MS = 220;

/**
 * 댓글을 숨길 때 실제로 속성을 붙일 요소.
 * 최상위 댓글은 답글 묶음이 댓글 요소의 형제라서, 댓글만 숨기면 "답글 N개"와 펼친 답글이 부모 없이 남는다.
 * 그래서 스레드 전체를 숨긴다. 답글은 자기 자신만 숨긴다.
 */
export function hideTargetOf(comment: HTMLElement): HTMLElement {
  if (comment.closest(REPLIES_SELECTOR)) return comment;
  return comment.closest<HTMLElement>(THREAD_SELECTOR) ?? comment;
}

/** 접히거나 펼쳐지는 중인 요소. 끝나면 desired에 적힌 최신 상태를 적용한다. */
const animating = new WeakSet<Element>();
const desired = new WeakMap<Element, string | null>();

/**
 * target의 숨김 상태를 hit에 맞춘다.
 * animate는 사용자가 차단이나 해제를 눌렀을 때만 참이다. 스크롤로 새로 붙은 댓글은 바로 숨겨서,
 * 이미 차단된 작성자의 댓글이 나타났다 사라지는 걸 막는다.
 */
export function setHidden(target: HTMLElement, hit: string | null, animate: boolean): void {
  if (animating.has(target)) {
    desired.set(target, hit);
    return;
  }
  const current = target.getAttribute(BLOCKED_ATTR);
  if (hit) {
    if (current === hit) return;
    if (current === null && animate) void collapse(target, hit);
    else target.setAttribute(BLOCKED_ATTR, hit);
  } else if (current !== null) {
    if (animate) void expand(target);
    else target.removeAttribute(BLOCKED_ATTR);
  }
}

async function collapse(target: HTMLElement, hit: string) {
  animating.add(target);
  desired.set(target, hit);
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
  const hit = desired.get(target) ?? null;
  if (hit) target.setAttribute(BLOCKED_ATTR, hit);
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
