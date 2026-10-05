/**
 * 순수 매칭 로직. DOM이나 브라우저 API에 의존하지 않아서 단위 테스트가 쉽다.
 */

/** 댓글 작성자를 식별하는 값. 페이지에서 읽지 못한 쪽은 비워 둔다. */
export interface Author {
  /** 화면에 보이는 "@handle". 본인이 바꿀 수 있다. */
  handle?: string;
  /** "UC"로 시작하는 채널 ID. 핸들을 바꿔도 그대로다. */
  channelId?: string;
}

/** 핸들 비교 전 정규화. 앞뒤 공백과 대소문자, 앞의 @는 무시한다. */
const normalizeHandle = (s: string) => s.trim().toLowerCase().replace(/^@/, '');

/**
 * author가 blocked 목록의 항목과 일치하면 그 항목을, 아니면 null.
 * 항목은 핸들이나 채널 ID 어느 쪽이든 될 수 있다.
 * 핸들은 대소문자와 앞의 @를 무시하고, 채널 ID는 대소문자가 다르면 다른 채널이라 그대로 비교한다.
 * 돌려주는 값은 사용자가 적은 원문이라 그대로 화면이나 속성에 보여줄 수 있다.
 */
export function findAuthor(author: Author, blocked: readonly string[]): string | null {
  const handle = author.handle ? normalizeHandle(author.handle) : '';
  const channelId = author.channelId?.trim() ?? '';
  if (!handle && !channelId) return null;

  for (const item of blocked) {
    const entry = item.trim();
    if (!entry) continue;
    if (channelId && entry === channelId) return item;
    if (handle && normalizeHandle(entry) === handle) return item;
  }
  return null;
}
