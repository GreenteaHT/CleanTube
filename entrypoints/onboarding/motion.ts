import { useEffect, useState } from 'react';

/**
 * 첫 사용 안내의 움직임. 쪽 넘김과 1쪽 장면을 Web Animations API로 움직인다(콘텐츠 스크립트의 display.ts와 같은 방식).
 * 시간과 자리를 여기 한 곳에만 둔다. CSS에 같은 숫자를 또 적으면 한쪽만 고쳤을 때 어긋난다.
 */

/** 쪽을 넘길 때 지금 쪽이 사라지는 시간과 다음 쪽이 나타나는 시간. */
const LEAVE_MS = 150;
const ENTER_MS = 220;

/** 1쪽 장면 한 바퀴. */
const HOW_TO_MS = 5500;

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** 지금 움직임 줄이기가 켜져 있는지. 누른 순간에 읽는다. 상태로 들고 있으면 설정을 바꾼 직후 한 번은 옛 값을 쓴다. */
export function prefersReducedMotion(): boolean {
  return matchMedia(REDUCED_MOTION).matches;
}

/** 움직임 줄이기를 켰는지. 바뀌면 다시 그린다. 계속 도는 장면처럼 설정이 바뀌면 바로 멈추거나 다시 돌아야 하는 곳에 쓴다. */
export function usePrefersReducedMotion(): boolean {
  const query = REDUCED_MOTION;
  const [reduced, setReduced] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** 지금 쪽을 사라지게 하고 다 사라지면 끝난다. 사라진 채로 붙잡아 둔다(다음 쪽은 새 요소라 상관없다). */
export async function leave(frame: HTMLElement): Promise<void> {
  const animation = frame.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: LEAVE_MS,
    easing: 'ease-in',
    fill: 'forwards',
  });
  try {
    await animation.finished;
  } catch {
    // 취소돼도 다음 쪽으로 넘어간다
  }
}

/** 새 쪽이 살짝 올라오며 나타난다. */
export function enter(frame: HTMLElement): void {
  frame.animate(
    [
      { opacity: 0, transform: 'translateY(6px)' },
      { opacity: 1, transform: 'none' },
    ],
    { duration: ENTER_MS, easing: 'ease-out' },
  );
}

interface Point {
  x: number;
  y: number;
}

/**
 * 1쪽 장면. 커서가 아래에서 댓글로 올라오면 CleanTube 버튼이 나타나고(유튜브처럼 댓글에 마우스를 올렸을 때),
 * 커서가 버튼을 누르면 메뉴가 열린다. 끝없이 되풀이한다.
 * 커서가 갈 자리는 그릴 때마다 실제 댓글 글과 버튼의 위치를 재서 정한다. 예시의 크기나 여백이 바뀌어도 버튼을 누른다.
 * 크기가 바뀌면(창 너비) 다시 재서 이어 간다. 돌려주는 함수를 부르면 멈춘다.
 */
export function playHowTo(scene: HTMLElement): () => void {
  const cursor = scene.querySelector<SVGElement>('.how-cursor');
  const trigger = scene.querySelector<HTMLElement>('[data-cleantube-trigger]');
  const menu = scene.querySelector<HTMLElement>('.menu');
  const text = scene.querySelector<HTMLElement>('.yt-text');
  if (!cursor || !trigger || !menu || !text) return () => {};

  let animations: Animation[] = [];

  const start = () => {
    // 다시 잴 때는 하던 데서 이어 간다
    const time = animations[0]?.currentTime ?? 0;
    animations.forEach((animation) => animation.cancel());

    const origin = scene.getBoundingClientRect();
    // 커서는 장면의 안쪽(테두리 안) 왼쪽 위를 기준으로 놓인다
    const local = (x: number, y: number): Point => ({
      x: x - origin.left - scene.clientLeft,
      y: y - origin.top - scene.clientTop,
    });
    const textBox = text.getBoundingClientRect();
    const buttonBox = trigger.getBoundingClientRect();
    const from = local(origin.left + origin.width * 0.3, origin.bottom - 40);
    const onText = local(textBox.left + textBox.width * 0.45, textBox.top + textBox.height / 2);
    const onButton = local(buttonBox.left + buttonBox.width / 2, buttonBox.top + buttonBox.height / 2);
    // 커서 그림의 화살표 끝이 (2, 1)에 있다. 끝이 가리키는 곳에 오게 그만큼 당긴다. 누를 때는 끝을 중심으로 줄어든다(App.css의 transform-origin)
    const at = (p: Point, scale = 1) => `translate(${p.x - 2}px, ${p.y - 1}px) scale(${scale})`;

    const options = { id: '', duration: HOW_TO_MS, iterations: Infinity };
    animations = [
      cursor.animate(
        [
          { offset: 0, transform: at(from), opacity: 0, easing: 'ease-in-out' },
          { offset: 0.06, opacity: 1, easing: 'ease-in-out' },
          { offset: 0.24, transform: at(onText), easing: 'ease-in-out' },
          { offset: 0.34, transform: at(onText), easing: 'ease-in-out' },
          { offset: 0.5, transform: at(onButton), easing: 'ease-in-out' },
          { offset: 0.54, transform: at(onButton, 0.8), easing: 'ease-in-out' },
          { offset: 0.58, transform: at(onButton), easing: 'ease-in-out' },
          { offset: 0.88, transform: at(onButton), opacity: 1, easing: 'ease-in-out' },
          { offset: 0.96, transform: at(onButton), opacity: 0 },
          { offset: 1, transform: at(onButton), opacity: 0 },
        ],
        { ...options, id: 'how-cursor' },
      ),
      // 커서가 댓글에 닿으면 나타난다. 유튜브에서 나타나는 것처럼 0.1초쯤에
      trigger.animate(
        [
          { offset: 0, opacity: 0, background: 'transparent' },
          { offset: 0.24, opacity: 0, background: 'transparent' },
          { offset: 0.26, opacity: 1, background: 'transparent' },
          { offset: 0.53, opacity: 1, background: 'transparent' },
          { offset: 0.55, opacity: 1, background: 'rgba(128, 128, 128, 0.2)' },
          { offset: 0.9, opacity: 1, background: 'rgba(128, 128, 128, 0.2)' },
          { offset: 0.96, opacity: 0, background: 'transparent' },
          { offset: 1, opacity: 0, background: 'transparent' },
        ],
        { ...options, id: 'how-trigger' },
      ),
      menu.animate(
        [
          { offset: 0, opacity: 0, transform: 'scale(0.96)' },
          { offset: 0.55, opacity: 0, transform: 'scale(0.96)', easing: 'ease-out' },
          { offset: 0.59, opacity: 1, transform: 'scale(1)' },
          { offset: 0.9, opacity: 1, transform: 'scale(1)', easing: 'ease-out' },
          { offset: 0.95, opacity: 0, transform: 'scale(1)' },
          { offset: 1, opacity: 0, transform: 'scale(1)' },
        ],
        { ...options, id: 'how-menu' },
      ),
    ];
    animations.forEach((animation) => (animation.currentTime = time));
  };

  start();
  const resized = new ResizeObserver(start);
  resized.observe(scene);
  return () => {
    resized.disconnect();
    animations.forEach((animation) => animation.cancel());
  };
}
