/**
 * 순수 매칭 로직. DOM이나 브라우저 API에 의존하지 않아서 단위 테스트가 쉽다.
 */

/** 비교 전 정규화. 앞뒤 공백과 대소문자, 앞의 @는 무시한다. */
const normalize = (s: string) => s.trim().toLowerCase().replace(/^@/, '');

/**
 * candidates(작성자 표시 이름, @핸들 등)가 blocked 목록의 항목과 정확히 일치하면 그 항목을, 아니면 null.
 * 앞의 @는 무시하므로 사용자가 "@handle"로 적든 "handle"로 적든 매칭된다.
 * 돌려주는 값은 사용자가 적은 원문이라 그대로 화면이나 속성에 보여줄 수 있다.
 */
export function findAuthor(
  candidates: readonly string[],
  blocked: readonly string[],
): string | null {
  const lookup = new Map<string, string>();
  for (const item of blocked) {
    const key = normalize(item);
    if (key) lookup.set(key, item);
  }
  if (lookup.size === 0) return null;

  for (const candidate of candidates) {
    const hit = lookup.get(normalize(candidate));
    if (hit) return hit;
  }
  return null;
}
