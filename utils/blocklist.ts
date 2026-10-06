import { storage } from '#imports';
import { entryKey, isExpired, matches, type Author, type BlockEntry } from './matcher';

/**
 * 차단 목록. 'local:' = chrome.storage.local.
 * sync는 항목당 8KB라 객체 80개 안팎에서 넘친다. local은 10MB라 사실상 한도가 없다.
 * 대신 다른 기기와 동기화되지 않는다. 설정(utils/settings.ts)은 작아서 sync에 남아 있다.
 * 모듈 밖으로 내보내지 않는다. 읽기, 쓰기, 구독은 아래 함수로만 해서 쓰기 규칙이 한 곳에 있게 한다.
 */
const blockedItem = storage.defineItem<BlockEntry[]>('local:blocked', {
  fallback: [],
});

export function loadBlocked(): Promise<BlockEntry[]> {
  return blockedItem.getValue();
}

export function watchBlocked(callback: (entries: BlockEntry[]) => void): () => void {
  return blockedItem.watch((next) => callback(next ?? []));
}

/** 키가 같은 기존 항목은 새 항목으로 바꾼다. 목록에 같은 키가 둘 있으면 안 된다. 팝업에서 손으로 넣을 때 쓴다. */
export async function addBlock(entry: BlockEntry): Promise<void> {
  const key = entryKey(entry);
  await update((entries) => [...entries.filter((e) => entryKey(e) !== key), entry]);
}

export async function removeBlock(entry: BlockEntry): Promise<void> {
  const key = entryKey(entry);
  await update((entries) => entries.filter((e) => entryKey(e) !== key));
}

/**
 * author에게 걸린 차단을 entry 하나로 바꾼다. 유튜브 화면에서 댓글을 보고 차단할 때 쓴다.
 * 같은 사람이 키가 다른 항목 여럿에 걸려 있을 수 있다. 손으로 넣은 핸들 항목과 메뉴로 넣은 채널 ID 항목이 그렇다.
 * 키가 같은 것만 바꾸면, 영구를 임시로 바꿔도 남은 영구 항목이 이겨서 그대로다. 그래서 author에게 걸리는 것을 전부 뺀다.
 * 빼고 넣는 것을 한 번에 쓴다. 나눠 쓰면 그 사이에 풀린 댓글이 화면에 나왔다가 다시 가려진다.
 */
export async function blockAuthor(author: Author, entry: BlockEntry): Promise<void> {
  const key = entryKey(entry);
  await update((entries) => [
    ...entries.filter((e) => entryKey(e) !== key && !matches(author, e)),
    entry,
  ]);
}

/** author에게 걸린 차단을 모두 푼다. 하나만 빼면 다른 항목에 걸려 그 댓글이 계속 가려져 있을 수 있다. */
export async function unblockAuthor(author: Author): Promise<void> {
  await update((entries) => entries.filter((e) => !matches(author, e)));
}

/**
 * 다른 창에서 바꾼 것을 덮어쓰지 않도록 최신 값을 읽어서 고친다.
 * 만료된 임시 차단은 매칭에서 이미 무시되고 있으므로, 쓰는 김에 여기서 치운다.
 */
async function update(change: (entries: BlockEntry[]) => BlockEntry[]) {
  const now = Date.now();
  const current = (await loadBlocked()).filter((e) => !isExpired(e, now));
  await blockedItem.setValue(change(current));
}
