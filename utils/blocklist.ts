import { storage } from '#imports';
import { entryKey, isExpired, parseEntry, type BlockEntry } from './matcher';

/**
 * 차단 목록. 'local:' = chrome.storage.local.
 * sync는 항목당 8KB라 객체 80개 안팎에서 넘친다. local은 10MB라 사실상 한도가 없다.
 * 대신 다른 기기와 동기화되지 않는다. 설정(utils/settings.ts)은 작아서 sync에 남아 있다.
 */
export const blockedItem = storage.defineItem<BlockEntry[]>('local:blocked', {
  fallback: [],
});

export async function loadBlocked(): Promise<BlockEntry[]> {
  // 모듈을 불러올 때가 아니라 처음 읽을 때 옮긴다. 빌드 중에는 브라우저 API가 없다.
  await (migrated ??= migrateLegacy());
  return blockedItem.getValue();
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

/**
 * 예전에는 차단 목록이 sync:settings 안에 문자열 배열(blockedAuthors)로 있었다. 한 번 옮기고 지운다.
 * 팝업과 콘텐츠 스크립트가 각자 실행해도 결과가 같다.
 * 그 형태로 저장한 브라우저가 더 없으면 이 함수는 지워도 된다.
 */
let migrated: Promise<void> | undefined;

async function migrateLegacy() {
  const old = await storage.getItem<{ blockedAuthors?: unknown }>('sync:settings');
  if (!old || !Array.isArray(old.blockedAuthors)) return;

  const entries = await blockedItem.getValue();
  const keys = new Set(entries.map(entryKey));
  for (const text of old.blockedAuthors) {
    const entry = typeof text === 'string' ? parseEntry(text) : null;
    if (entry && !keys.has(entryKey(entry))) {
      keys.add(entryKey(entry));
      entries.push(entry);
    }
  }
  await blockedItem.setValue(entries);

  const { blockedAuthors: _moved, ...rest } = old;
  await storage.setItem('sync:settings', rest);
}
