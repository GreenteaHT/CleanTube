import { storage } from '#imports';
import { entryKey, isExpired, type BlockEntry } from './matcher';

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

/** 같은 대상의 기존 항목은 새 항목으로 바꾼다. 임시 차단을 영구로 바꾸거나 기간을 다시 정할 때. */
export async function addBlock(entry: BlockEntry): Promise<void> {
  const key = entryKey(entry);
  await update((entries) => [...entries.filter((e) => entryKey(e) !== key), entry]);
}

export async function removeBlock(entry: BlockEntry): Promise<void> {
  const key = entryKey(entry);
  await update((entries) => entries.filter((e) => entryKey(e) !== key));
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
