/**
 * 순수 매칭 로직. DOM이나 브라우저 API에 의존하지 않아서 단위 테스트가 쉽다.
 * 현재 시각도 인자로 받는다.
 */

/** 댓글 작성자를 식별하는 값. 페이지에서 읽지 못한 쪽은 비워 둔다. */
export interface Author {
  /** 화면에 보이는 "@handle". 본인이 바꿀 수 있다. */
  handle?: string;
  /** "UC"로 시작하는 채널 ID. 핸들을 바꿔도 그대로다. */
  channelId?: string;
}

/** 차단 목록의 한 줄. channelId와 handle 중 하나는 있다. */
export interface BlockEntry {
  /** 메뉴나 패널에서 차단하면 들어간다. 있으면 이것으로 매칭한다. */
  channelId?: string;
  /** 손으로 입력한 항목은 이것만 있다. channelId가 있을 때는 목록에 보여 줄 이름이기도 하다. */
  handle?: string;
  /** 임시 차단이 풀리는 시각(epoch ms). 없으면 영구 차단. */
  until?: number;
  /** 차단한 시각(epoch ms). 이 필드가 생기기 전에 만든 항목에는 없다. */
  at?: number;
  /** 어느 댓글을 보고 차단했는지. 댓글 메뉴나 패널에서 차단했을 때만 있다. 매칭에는 쓰지 않는다. */
  source?: BlockSource;
}

/** 차단할 때 보고 있던 댓글. 나중에 목록에서 왜 차단했는지 떠올릴 수 있게 남긴다. */
export interface BlockSource {
  /** 그 댓글로 바로 가는 주소. */
  url: string;
  videoTitle?: string;
  /** 댓글 내용. 길면 잘라서 넣는다. */
  text?: string;
}

/** 핸들 비교 전 정규화. 앞뒤 공백과 대소문자, 앞의 @는 무시한다. */
const normalizeHandle = (s: string) => s.trim().toLowerCase().replace(/^@/, '');

const CHANNEL_ID = /^UC[\w-]{22}$/;

/** 사용자가 손으로 입력한 글자를 차단 항목으로. 채널 ID 모양이면 채널 ID, 아니면 핸들. 비어 있으면 null. */
export function parseEntry(text: string): BlockEntry | null {
  const value = text.trim();
  if (CHANNEL_ID.test(value)) return { channelId: value };
  const handle = normalizeHandle(value);
  return handle ? { handle: `@${value.replace(/^@/, '')}` } : null;
}

/** 같은 대상을 가리키는 항목인지 가리는 키. 목록에서 중복을 막고 지울 때 쓴다. */
export function entryKey(entry: BlockEntry): string {
  return entry.channelId ?? `@${normalizeHandle(entry.handle ?? '')}`;
}

export function isExpired(entry: BlockEntry, now: number): boolean {
  return entry.until !== undefined && entry.until <= now;
}

/**
 * author를 차단하는 항목을, 없으면 null.
 * 만료된 임시 차단은 건너뛴다. 영구와 임시가 둘 다 걸리면 영구를 돌려준다.
 */
export function findBlock(
  author: Author,
  entries: readonly BlockEntry[],
  now: number,
): BlockEntry | null {
  let temporary: BlockEntry | null = null;
  for (const entry of entries) {
    if (isExpired(entry, now) || !matches(author, entry)) continue;
    if (entry.until === undefined) return entry;
    temporary ??= entry;
  }
  return temporary;
}

function matches(author: Author, entry: BlockEntry): boolean {
  // 양쪽 다 채널 ID가 있으면 그것만 본다. 대소문자가 다르면 다른 채널이다.
  // 핸들까지 보면, 차단한 사람이 버린 핸들을 나중에 가져간 다른 사람이 걸린다.
  if (entry.channelId && author.channelId) return entry.channelId === author.channelId;
  // 한쪽이라도 채널 ID가 없으면 핸들로. 유튜브 구조가 바뀌어 채널 ID를 못 읽게 돼도 차단이 유지된다.
  if (!entry.handle || !author.handle) return false;
  const handle = normalizeHandle(entry.handle);
  return handle !== '' && handle === normalizeHandle(author.handle);
}
