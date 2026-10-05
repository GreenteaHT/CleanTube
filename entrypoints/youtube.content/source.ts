import type { BlockSource } from '@/utils/matcher';

/**
 * 댓글 헤더의 작성 시각("6년 전")에 유튜브가 걸어 둔 링크. 주소가 /watch?v=<영상>&lc=<댓글>이라
 * 열면 그 댓글이 맨 위에 강조돼 나온다. 답글도 같은 자리에 있다.
 */
const PERMALINK_SELECTOR = '#published-time-text a';

/** 댓글 본문. */
const TEXT_SELECTOR = '#content-text';

/** 영상 페이지에서 플레이어 아래의 영상 제목. */
const VIDEO_TITLE_SELECTOR = 'ytd-watch-metadata #title yt-formatted-string';

// 목록에서 알아볼 만큼만 남긴다. 저장 공간(storage.local 10MB)에 비하면 작다.
const MAX_TEXT = 300;
const MAX_TITLE = 150;

/** 차단할 때 그 댓글의 위치와 내용을 읽는다. 링크를 못 찾으면 남길 게 없으니 undefined. */
export function readSource(comment: HTMLElement): BlockSource | undefined {
  const href = comment.querySelector(PERMALINK_SELECTOR)?.getAttribute('href');
  if (!href) return undefined;
  const url = new URL(href, location.href);
  // 팝업에서 링크로 열 주소라 유튜브 주소일 때만 남긴다
  if (url.origin !== location.origin) return undefined;

  const source: BlockSource = { url: url.href };
  const title =
    document.querySelector(VIDEO_TITLE_SELECTOR)?.textContent?.trim() ||
    document.title.replace(/ - YouTube$/, '');
  if (title) source.videoTitle = clip(title, MAX_TITLE);
  const text = textOf(comment.querySelector(TEXT_SELECTOR)).trim();
  if (text) source.text = clip(text, MAX_TEXT);
  return source;
}

/** 유튜브는 이모지를 <img alt="😭">로 그린다. textContent만 읽으면 이모지가 빠진다. */
function textOf(node: Node | null): string {
  if (!node) return '';
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node instanceof HTMLImageElement) return node.alt;
  let out = '';
  for (const child of node.childNodes) out += textOf(child);
  return out;
}

function clip(text: string, max: number): string {
  // 이모지처럼 두 칸짜리 글자가 반으로 잘리지 않게 글자 단위로 센다
  const chars = [...text];
  return chars.length <= max ? text : `${chars.slice(0, max).join('')}…`;
}
