/**
 * 차단 목록을 storage.sync에 나눠 담고, 다른 PC에서 온 것과 합치는 순수 함수.
 * DOM, storage, WXT를 import하지 않는다. 현재 시각도 인자로 받는다. 테스트는 tests/blocksync.test.ts.
 * 읽고 쓰는 쪽은 utils/blocklist.ts, 언제 맞출지는 entrypoints/background.ts가 정한다.
 */
import { DAY_MS } from './duration';
import { entryKey, isExpired, type BlockEntry } from './matcher';

/** 한 PC의 차단 목록과, 언제 무엇을 뺐는지. */
export interface BlockState {
  entries: BlockEntry[];
  /**
   * 뺀 항목의 키와 뺀 시각(epoch ms). 다른 PC가 아직 그 항목을 들고 있다가 되살리지 않게 남긴다.
   * 기간이 끝난 임시 차단은 어느 PC에서나 똑같이 끝나므로 여기 적지 않는다.
   */
  removed: Record<string, number>;
}

/**
 * sync 키 하나에 담는 모양. 용량이 빠듯해서 필드 이름 없이 배열로 줄인다.
 * 차단한 경위(source)는 담지 않는다. 용량을 많이 먹고, 이 브라우저 밖으로 내보내지 않기로 한 데이터다.
 */
export interface SyncBucket {
  /** [채널 ID, 핸들, 차단한 시각, 풀리는 시각]. 없는 값은 '' 또는 0. 풀리는 시각은 임시 차단에만 있다. */
  e?: SyncEntry[];
  /** [키, 뺀 시각] */
  r?: SyncRemoval[];
}
type SyncEntry = [string, string, number] | [string, string, number, number];
type SyncRemoval = [string, number];

/** 동기화 상태. 백그라운드가 계산해서 남기고, 팝업과 차단 목록 페이지가 안내에 쓴다. */
export interface SyncStatus {
  usedBytes: number;
  budgetBytes: number;
  /** 공간이 모자라 sync에 담지 못한 항목 수. 오래전에 차단한 것부터 빠진다. */
  unsynced: number;
}

export type SyncWarning = { kind: 'over'; unsynced: number } | { kind: 'near'; percent: number };

/** sync에 쓰는 키 개수. 키 하나는 8KB까지라 100KB를 다 쓰려면 13개 이상이어야 한다. 한 키에 몰려 넘치지 않게 넉넉히. */
export const BUCKET_COUNT = 32;
const BUCKET_PREFIX = 'blocked.';
/** chrome.storage.sync의 전체 한도 102,400바이트에서 설정(sync:settings) 몫으로 2KB를 남긴다. 임시값. */
export const SYNC_BUDGET_BYTES = 102_400 - 2_048;
/** chrome.storage.sync의 키 하나 한도(QUOTA_BYTES_PER_ITEM). 키 이름 길이도 포함된다. */
const ITEM_LIMIT_BYTES = 8_192;
/** 뺀 기록을 남겨 두는 기간. 이보다 오래 꺼져 있던 PC는 뺀 항목을 되살릴 수 있다. 임시값. */
export const REMOVED_TTL_MS = 30 * DAY_MS;
/** 이만큼 차면 안내한다. 임시값. */
const WARN_RATIO = 0.9;

/** 0번부터 BUCKET_COUNT-1번까지의 sync 키 이름. "blocked.00" */
export function bucketKey(index: number): string {
  return `${BUCKET_PREFIX}${String(index).padStart(2, '0')}`;
}

export function isBucketKey(key: string): boolean {
  return key.startsWith(BUCKET_PREFIX);
}

/**
 * 두 PC의 상태를 항목마다 합친다. 더 나중에 한 쪽이 이긴다. 차단은 차단한 시각, 빼기는 뺀 시각으로 비교한다.
 * 기간이 끝난 임시 차단과 REMOVED_TTL_MS보다 오래된 빼기 기록은 버린다.
 * 바뀐 것이 없으면 local의 항목 객체와 순서를 그대로 돌려준다. 그래야 쓸 필요가 있는지 비교할 수 있다.
 */
export function mergeStates(local: BlockState, remote: BlockState, now: number): BlockState {
  const remoteByKey = new Map(remote.entries.map((e) => [entryKey(e), e]));
  const removedAt = (key: string) => Math.max(local.removed[key] ?? -1, remote.removed[key] ?? -1);

  const entries: BlockEntry[] = [];
  const kept = new Set<string>();
  const keep = (key: string, entry: BlockEntry) => {
    if (kept.has(key) || isExpired(entry, now) || timeOf(entry) <= removedAt(key)) return;
    kept.add(key);
    entries.push(entry);
  };

  for (const mine of local.entries) {
    const key = entryKey(mine);
    keep(key, pickNewer(mine, remoteByKey.get(key)));
  }
  // 이 PC에 없던 항목은 차단한 시각 순으로 뒤에 붙인다. 저장된 순서는 넣은 순서라서.
  const localKeys = new Set(local.entries.map(entryKey));
  const incoming = remote.entries
    .filter((e) => !localKeys.has(entryKey(e)))
    .sort((a, b) => timeOf(a) - timeOf(b));
  for (const theirs of incoming) keep(entryKey(theirs), theirs);

  const removed: Record<string, number> = {};
  for (const key of new Set([...Object.keys(local.removed), ...Object.keys(remote.removed)])) {
    const at = removedAt(key);
    // 뺀 뒤에 다시 차단했으면 빼기 기록은 할 일이 끝났다
    if (!kept.has(key) && now - at < REMOVED_TTL_MS) removed[key] = at;
  }
  return { entries, removed };
}

/**
 * 같은 사람의 두 항목 중 나중 것. 시각이 같으면 이 PC의 것(경위가 붙어 있다).
 * 다른 PC가 나중에 다시 차단했으면 그 항목을 쓰되, 이 PC에 남은 경위는 옮겨 붙인다. sync에는 경위가 없어서
 * 그대로 바꾸면 이 PC에서 왜 차단했는지가 사라진다.
 */
function pickNewer(mine: BlockEntry, theirs: BlockEntry | undefined): BlockEntry {
  if (!theirs || timeOf(theirs) <= timeOf(mine)) return mine;
  return mine.source && !theirs.source ? { ...theirs, source: mine.source } : theirs;
}

/** 차단한 시각. 이 필드가 생기기 전에 만든 항목은 가장 오래된 것으로 친다. */
function timeOf(entry: BlockEntry): number {
  return entry.at ?? 0;
}

/**
 * sync에 담을 모양을 만든다. 빼기 기록을 먼저 담고, 차단은 최근에 차단한 것부터 담는다.
 * 공간이 모자라면 그보다 오래된 차단은 담지 않는다(사용자가 정함). 담지 못한 차단도 이 PC에서는 그대로 가려진다.
 * 같은 상태면 어느 PC에서 만들어도 똑같은 결과가 나와야 한다. 다르면 두 PC가 서로 덮어쓰기를 되풀이한다.
 * 그래서 저장된 순서가 아니라 시각과 키로 정렬한다.
 */
export function packState(
  state: BlockState,
  budgetBytes = SYNC_BUDGET_BYTES,
): { buckets: (SyncBucket | null)[]; status: SyncStatus } {
  const slots = Array.from({ length: BUCKET_COUNT }, (_, index) => ({
    name: bucketKey(index),
    e: [] as SyncEntry[],
    r: [] as SyncRemoval[],
    bytes: 0,
  }));
  let used = 0;

  // 들어갈 자리가 있으면 담을 키를 돌려준다. 키 하나의 한도도 지킨다.
  const slotFor = (key: string, item: SyncEntry | SyncRemoval) => {
    const slot = slots[bucketIndex(key)]!;
    // 빈 키에 처음 담을 때는 키 이름과 {"e":[],"r":[]}만큼이 더 든다. 항목 사이의 쉼표 하나도 넉넉히 센다.
    const base = slot.bytes === 0 ? slot.name.length + EMPTY_BUCKET_BYTES : 0;
    const add = base + syncLength(item) + 1;
    if (used + add > budgetBytes || slot.bytes + add > ITEM_LIMIT_BYTES) return null;
    used += add;
    slot.bytes += add;
    return slot;
  };

  const removed = Object.entries(state.removed).sort(([ka, a], [kb, b]) => b - a || compare(ka, kb));
  for (const [key, at] of removed) {
    const item: SyncRemoval = [key, at];
    // 빼기 기록이 못 들어가면 다른 PC에서 되살아날 수 있지만, 작고 30일이면 지워져서 차단보다 먼저 담는 것으로 충분하다
    slotFor(key, item)?.r.push(item);
  }

  const sorted = [...state.entries].sort(
    (a, b) => timeOf(b) - timeOf(a) || compare(entryKey(a), entryKey(b)),
  );
  let unsynced = 0;
  let full = false;
  for (const entry of sorted) {
    const item = toSyncEntry(entry);
    const slot = full ? null : slotFor(entryKey(entry), item);
    if (slot) {
      slot.e.push(item);
    } else {
      // 한 번 모자라면 그보다 오래된 것은 담지 않는다. 작은 항목이 빈틈에 들어가 순서가 뒤섞이지 않게.
      full = true;
      unsynced++;
    }
  }

  const buckets = slots.map(({ e, r }): SyncBucket | null => {
    if (e.length === 0 && r.length === 0) return null;
    return { ...(e.length > 0 && { e }), ...(r.length > 0 && { r }) };
  });
  return { buckets, status: { usedBytes: used, budgetBytes, unsynced } };
}

const EMPTY_BUCKET_BYTES = '{"e":[],"r":[]}'.length;

function toSyncEntry(entry: BlockEntry): SyncEntry {
  const base: [string, string, number] = [entry.channelId ?? '', entry.handle ?? '', entry.at ?? 0];
  return entry.until === undefined ? base : [...base, entry.until];
}

/**
 * sync에서 읽은 값들을 상태로. 다른 PC나 예전 버전이 쓴 값이라 모양을 그대로 믿지 않고, 맞지 않는 것은 버린다.
 * 같은 키가 둘이면 나중 것을 쓴다.
 */
export function unpackBuckets(values: readonly unknown[]): BlockState {
  const byKey = new Map<string, BlockEntry>();
  const removed: Record<string, number> = {};
  for (const value of values) {
    if (!isObject(value)) continue;
    for (const item of Array.isArray(value.e) ? value.e : []) {
      const entry = fromSyncEntry(item);
      if (!entry) continue;
      const key = entryKey(entry);
      const prev = byKey.get(key);
      if (!prev || timeOf(entry) > timeOf(prev)) byKey.set(key, entry);
    }
    for (const item of Array.isArray(value.r) ? value.r : []) {
      if (!Array.isArray(item) || typeof item[0] !== 'string' || !isTime(item[1]) || item[0] === '') continue;
      removed[item[0]] = Math.max(removed[item[0]] ?? -1, item[1]);
    }
  }
  return { entries: [...byKey.values()], removed };
}

function fromSyncEntry(item: unknown): BlockEntry | null {
  if (!Array.isArray(item) || item.length < 3 || item.length > 4) return null;
  const [channelId, handle, at, until] = item as unknown[];
  if (typeof channelId !== 'string' || typeof handle !== 'string' || !isTime(at)) return null;
  if (until !== undefined && !isTime(until)) return null;
  if (!channelId && !handle) return null;
  const entry: BlockEntry = {};
  if (channelId) entry.channelId = channelId;
  if (handle) entry.handle = handle;
  // 0은 차단한 시각이 없는 예전 항목이다. 이 PC의 항목과 모양이 같아야 바뀐 게 없다고 판단한다.
  if (at > 0) entry.at = at;
  if (until !== undefined) entry.until = until;
  return entry;
}

/** 두 상태가 같은지. 쓸 필요가 있는지 가릴 때 쓴다. 항목은 순서까지 같아야 같다. */
export function sameState(a: BlockState, b: BlockState): boolean {
  return JSON.stringify(a.entries) === JSON.stringify(b.entries) && sameRecord(a.removed, b.removed);
}

function sameRecord(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}

/** 팝업과 차단 목록 페이지가 띄울 안내. 없으면 null. */
export function syncWarning(status: SyncStatus | null): SyncWarning | null {
  if (!status) return null;
  if (status.unsynced > 0) return { kind: 'over', unsynced: status.unsynced };
  const ratio = status.usedBytes / status.budgetBytes;
  return ratio >= WARN_RATIO ? { kind: 'near', percent: Math.floor(ratio * 100) } : null;
}

/**
 * 키를 어느 sync 키에 담을지. 항목 하나를 바꾸면 sync 키 하나만 다시 쓰게 고정된 자리를 준다.
 * FNV-1a. 어느 PC에서나 같은 값이 나와야 한다.
 */
function bucketIndex(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % BUCKET_COUNT;
}

/**
 * 크롬이 sync 한도를 셀 때의 길이. 크롬은 값을 자기 JSON으로 적어서 센다(2026-11-13 실측).
 * 글자는 UTF-8 바이트로 센다. int32를 넘는 수(시각)는 1.794501596429e+12처럼 지수로 적어서
 * JSON.stringify보다 5바이트쯤 길다. 이걸 모르고 세면 한도를 넘겨 쓰기가 통째로 실패한다.
 */
function syncLength(item: SyncEntry | SyncRemoval): number {
  // 대괄호 둘과 값 사이의 쉼표
  let length = 2 + item.length - 1;
  for (const value of item) {
    length += typeof value === 'number' ? numberLength(value) : byteLength(JSON.stringify(value));
  }
  return length;
}

function numberLength(n: number): number {
  if (Number.isInteger(n) && Math.abs(n) <= 0x7fffffff) return String(n).length;
  const text = n.toExponential();
  // 지수가 한 자리면 크롬이 e+09처럼 적을 수 있어서 한 자리 넉넉히 센다
  return text.length + (/e[+-]\d$/.test(text) ? 1 : 0);
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** 로캘과 무관하게 어느 PC에서나 같은 순서. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
