import { browser, storage, type StorageItemKey } from '#imports';
import {
  BUCKET_COUNT,
  bucketKey,
  canForget,
  isBucketKey,
  mergeStates,
  packState,
  sameState,
  unpackBuckets,
  type BlockState,
  type SyncStatus,
} from './blocksync';
import { entryKey, matches, type Author, type BlockEntry } from './matcher';

/**
 * 차단 목록. 'local:' = chrome.storage.local. 유튜브 탭, 팝업, 차단 목록 페이지는 이것만 읽고 쓴다.
 * 다른 PC와는 백그라운드가 syncBlocked()로 storage.sync를 거쳐 맞춘다. sync는 키 하나가 8KB라
 * 목록을 통째로 넣지 못하고, 차단한 경위는 이 브라우저 밖으로 내보내지 않기로 해서 이쪽이 원본이다.
 * 모듈 밖으로 내보내지 않는다. 읽기, 쓰기, 구독은 아래 함수로만 해서 쓰기 규칙이 한 곳에 있게 한다.
 */
const blockedItem = storage.defineItem<BlockEntry[]>('local:blocked', {
  fallback: [],
});

/** 뺀 항목의 키와 뺀 시각. 다른 PC가 옛 목록으로 되살리지 않게 sync로도 보낸다. */
const removedItem = storage.defineItem<Record<string, number>>('local:blockedRemoved', {
  fallback: {},
});

/** 백그라운드가 마지막으로 맞춘 결과. 팝업과 차단 목록 페이지가 한도 안내에 쓴다. 아직 없으면 null. */
const syncStatusItem = storage.defineItem<SyncStatus | null>('local:blockSyncStatus', {
  fallback: null,
});

/** sync에 나눠 담는 키들. "sync:blocked.00"부터 */
const BUCKET_KEYS = Array.from(
  { length: BUCKET_COUNT },
  (_, i) => `sync:${bucketKey(i)}` as StorageItemKey,
);

export function loadBlocked(): Promise<BlockEntry[]> {
  return blockedItem.getValue();
}

export function watchBlocked(callback: (entries: BlockEntry[]) => void): () => void {
  return blockedItem.watch((next) => callback(next ?? []));
}

/** 키가 같은 기존 항목은 새 항목으로 바꾼다. 목록에 같은 키가 둘 있으면 안 된다. 차단 목록 페이지에서 손으로 넣을 때 쓴다. */
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
 * 기간이 끝난 임시 차단은 매칭에서 이미 무시되고 있다. 끝난 지 오래된 것(canForget)은 쓰는 김에 여기서 치운다.
 * 뺀 항목은 뺀 시각을 남기고, 다시 넣은 항목은 그 기록을 지운다. 목록과 기록은 한 번에 쓴다.
 */
async function update(change: (entries: BlockEntry[]) => BlockEntry[]) {
  const now = Date.now();
  const [current, removed] = await Promise.all([loadBlocked(), removedItem.getValue()]);
  const before = current.filter((e) => !canForget(e, now));
  const after = change(before);
  const kept = new Set(after.map(entryKey));
  const nextRemoved = { ...removed };
  for (const e of before) {
    const key = entryKey(e);
    if (!kept.has(key)) nextRemoved[key] = now;
  }
  for (const key of kept) delete nextRemoved[key];
  await storage.setItems([
    { item: blockedItem, value: after },
    { item: removedItem, value: nextRemoved },
  ]);
}

/**
 * 이 PC의 목록과 sync를 맞춘다. 백그라운드만 부른다. 여러 곳에서 부르면 쓰기 한도(분당 120회)에 걸리고 서로 덮어쓴다.
 * 1. sync에 있는 것(다른 PC가 올린 것)을 이 PC의 목록에 합친다. 바뀌었을 때만 쓴다.
 * 2. 합친 목록을 sync 모양으로 만들어, 달라진 키만 쓴다.
 * 쓴 것이 또 변경 알림을 부르지만, 다음 번에는 바뀐 게 없어서 아무것도 쓰지 않고 끝난다.
 */
export async function syncBlocked(): Promise<void> {
  const now = Date.now();
  const [entries, removed, bucketValues, status] = await Promise.all([
    loadBlocked(),
    removedItem.getValue(),
    storage.getItems(BUCKET_KEYS),
    syncStatusItem.getValue(),
  ]);
  const local: BlockState = { entries, removed };
  const byKey = new Map(bucketValues.map((b) => [b.key, b.value as unknown]));
  const remoteValues = BUCKET_KEYS.map((key) => byKey.get(key) ?? null);
  const merged = mergeStates(local, unpackBuckets(remoteValues), now);
  if (!sameState(local, merged)) {
    await storage.setItems([
      { item: blockedItem, value: merged.entries },
      { item: removedItem, value: merged.removed },
    ]);
  }

  const packed = packState(merged);
  const toSet: { key: StorageItemKey; value: unknown }[] = [];
  const toRemove: StorageItemKey[] = [];
  BUCKET_KEYS.forEach((key, i) => {
    const bucket = packed.buckets[i] ?? null;
    if (JSON.stringify(bucket) === JSON.stringify(remoteValues[i] ?? null)) return;
    if (bucket) toSet.push({ key, value: bucket });
    else toRemove.push(key);
  });
  // 각각 한 번의 호출이라 쓰기 한도에서 한 번씩만 센다. 빼기를 먼저 한다. 한도에 가까울 때 쓰기를 먼저 하면
  // 지울 키가 아직 남아 있는 동안 합계가 한도를 넘어 쓰기가 실패할 수 있다.
  // sync에서 잠깐 사라지는 것은 다른 PC에 빼기로 읽히지 않는다. 빼기는 뺀 기록으로만 전한다.
  if (toRemove.length > 0) await storage.removeItems(toRemove);
  if (toSet.length > 0) await storage.setItems(toSet);

  if (JSON.stringify(status) !== JSON.stringify(packed.status)) {
    await syncStatusItem.setValue(packed.status);
  }
}

/**
 * syncBlocked()를 다시 돌릴 때를 알린다. 이 PC의 목록이 바뀌었거나, 다른 PC가 sync를 바꿨을 때.
 * 상태(blockSyncStatus)만 바뀐 것은 알리지 않는다. 그걸 알리면 맞출 때마다 또 맞춘다.
 */
export function watchBlockSyncSources(callback: () => void): () => void {
  const localKeys = new Set([blockedItem.key, removedItem.key].map((k) => k.replace(/^local:/, '')));
  const listener = (changes: Record<string, unknown>, area: string) => {
    const keys = Object.keys(changes);
    if (area === 'sync' ? keys.some(isBucketKey) : area === 'local' && keys.some((k) => localKeys.has(k))) {
      callback();
    }
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

export function loadSyncStatus(): Promise<SyncStatus | null> {
  return syncStatusItem.getValue();
}

export function watchSyncStatus(callback: (status: SyncStatus | null) => void): () => void {
  return syncStatusItem.watch(callback);
}
