/**
 * 순수 매칭 로직. DOM이나 브라우저 API에 의존하지 않아서 단위 테스트가 쉽다.
 */

const normalize = (s: string) => s.trim().toLowerCase();
const stripHandle = (s: string) => normalize(s).replace(/^@/, '');

/** text 안에 keywords 중 하나라도 포함되면 그 키워드를, 아니면 null을 돌려준다 */
export function findKeyword(text: string, keywords: readonly string[]): string | null {
  const haystack = normalize(text);
  if (!haystack) return null;

  for (const keyword of keywords) {
    const needle = normalize(keyword);
    if (needle && haystack.includes(needle)) return keyword;
  }
  return null;
}

/**
 * candidates(채널명, @핸들 등)가 blocked 목록의 항목과 정확히 일치하면 그 항목을, 아니면 null.
 * 앞의 @는 무시하므로 사용자가 "@handle"로 적든 "handle"로 적든 매칭된다.
 */
export function findChannel(
  candidates: readonly string[],
  blocked: readonly string[],
): string | null {
  const lookup = new Map<string, string>();
  for (const item of blocked) {
    const key = stripHandle(item);
    if (key) lookup.set(key, item);
  }
  if (lookup.size === 0) return null;

  for (const candidate of candidates) {
    const hit = lookup.get(stripHandle(candidate));
    if (hit) return hit;
  }
  return null;
}
