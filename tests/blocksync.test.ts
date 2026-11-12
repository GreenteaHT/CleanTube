import { describe, expect, it } from 'vitest';
import {
  BUCKET_COUNT,
  REMOVED_TTL_MS,
  bucketKey,
  mergeStates,
  packState,
  sameState,
  syncWarning,
  unpackBuckets,
  type BlockState,
} from '../utils/blocksync';
import type { BlockEntry } from '../utils/matcher';

const NOW = 1_800_000_000_000;
const ID = 'UCrKxP6IDEsFLuX_g8bx-43w';
const OTHER_ID = 'UCC5NfQ6Mf0dq_eEwv4P_hWA';

const state = (entries: BlockEntry[] = [], removed: Record<string, number> = {}): BlockState => ({
  entries,
  removed,
});

/** 한 PC가 sync에 올린 것을 다른 PC가 읽는 길. */
const roundTrip = (s: BlockState) => unpackBuckets(packState(s).buckets);

/** 서로 다른 채널 ID n개. 22자를 숫자로 채운다. */
const channels = (n: number, at = (i: number) => NOW - i): BlockEntry[] =>
  Array.from({ length: n }, (_, i) => ({
    channelId: `UC${String(i).padStart(22, '0')}`,
    handle: `@user${i}`,
    at: at(i),
  }));

describe('mergeStates: 차단', () => {
  it('다른 PC에만 있는 차단을 들여온다', () => {
    const remote = state([{ channelId: ID, handle: '@a', at: NOW - 10 }]);
    expect(mergeStates(state(), remote, NOW).entries).toEqual(remote.entries);
  });

  it('같은 사람이면 나중에 차단한 쪽이 이긴다. 영구를 임시로 바꾼 것도 그대로 온다', () => {
    const local = state([{ channelId: ID, at: NOW - 100 }]);
    const remote = state([{ channelId: ID, at: NOW - 10, until: NOW + 1000 }]);
    expect(mergeStates(local, remote, NOW).entries).toEqual([{ channelId: ID, at: NOW - 10, until: NOW + 1000 }]);
  });

  it('시각이 같으면 이 PC의 항목을 쓴다. 경위가 붙어 있다', () => {
    const mine = { channelId: ID, at: NOW - 10, source: { url: 'https://www.youtube.com/watch?v=x' } };
    const merged = mergeStates(state([mine]), state([{ channelId: ID, at: NOW - 10 }]), NOW);
    expect(merged.entries[0]).toBe(mine);
  });

  it('다른 PC가 나중에 다시 차단해도 이 PC의 경위는 남긴다', () => {
    const source = { url: 'https://www.youtube.com/watch?v=x', text: '댓글' };
    const local = state([{ channelId: ID, at: NOW - 100, source }]);
    const remote = state([{ channelId: ID, at: NOW - 10, until: NOW + 1000 }]);
    expect(mergeStates(local, remote, NOW).entries).toEqual([
      { channelId: ID, at: NOW - 10, until: NOW + 1000, source },
    ]);
  });

  it('기간이 끝난 임시 차단은 어느 쪽에서 왔든 버린다', () => {
    const local = state([{ channelId: ID, at: NOW - 100, until: NOW - 1 }]);
    const remote = state([{ channelId: OTHER_ID, at: NOW - 100, until: NOW }]);
    expect(mergeStates(local, remote, NOW).entries).toEqual([]);
  });

  it('이 PC의 순서를 지키고 새로 온 것은 차단한 시각 순으로 뒤에 붙인다', () => {
    const local = state([{ handle: '@b', at: NOW - 5 }, { handle: '@a', at: NOW - 50 }]);
    const remote = state([{ handle: '@d', at: NOW - 1 }, { handle: '@c', at: NOW - 30 }]);
    expect(mergeStates(local, remote, NOW).entries.map((e) => e.handle)).toEqual(['@b', '@a', '@c', '@d']);
  });
});

describe('mergeStates: 빼기', () => {
  it('다른 PC에서 뺀 것은 이 PC에서도 빠진다', () => {
    const local = state([{ channelId: ID, at: NOW - 100 }]);
    const remote = state([], { [ID]: NOW - 10 });
    const merged = mergeStates(local, remote, NOW);
    expect(merged.entries).toEqual([]);
    expect(merged.removed).toEqual({ [ID]: NOW - 10 });
  });

  it('뺀 뒤에 다시 차단했으면 차단이 이기고 빼기 기록은 지운다', () => {
    const local = state([{ channelId: ID, at: NOW - 5 }]);
    const remote = state([], { [ID]: NOW - 10 });
    expect(mergeStates(local, remote, NOW)).toEqual(state([{ channelId: ID, at: NOW - 5 }]));
  });

  it('옛 목록을 들고 있던 PC가 뺀 항목을 되살리지 않는다', () => {
    const local = state([], { [ID]: NOW - 10 });
    const stale = state([{ channelId: ID, at: NOW - 100 }]);
    expect(mergeStates(local, stale, NOW).entries).toEqual([]);
  });

  it('시각이 같으면 빼기가 이긴다', () => {
    const merged = mergeStates(state([{ channelId: ID, at: NOW - 10 }]), state([], { [ID]: NOW - 10 }), NOW);
    expect(merged.entries).toEqual([]);
  });

  it('차단한 시각이 없는 예전 항목도 빼기로 지운다', () => {
    const merged = mergeStates(state([{ handle: '@old' }]), state([], { '@old': NOW - 10 }), NOW);
    expect(merged.entries).toEqual([]);
  });

  it('기간이 지난 빼기 기록은 버린다', () => {
    const merged = mergeStates(state([], { [ID]: NOW - REMOVED_TTL_MS }), state(), NOW);
    expect(merged.removed).toEqual({});
  });
});

describe('mergeStates: 바뀐 게 없을 때', () => {
  it('같은 상태를 합치면 그대로다', () => {
    const local = state(channels(5), { [OTHER_ID]: NOW - 3 });
    expect(sameState(mergeStates(local, roundTrip(local), NOW), local)).toBe(true);
  });
});

describe('packState와 unpackBuckets', () => {
  it('경위는 담지 않고 나머지는 그대로 오간다', () => {
    const entries: BlockEntry[] = [
      { channelId: ID, handle: '@SanDiegoZoo', at: NOW - 1, source: { url: 'https://www.youtube.com/watch?v=x' } },
      { handle: '@김무식-i9t', at: NOW - 2, until: NOW + 1000 },
      { channelId: OTHER_ID },
    ];
    const back = roundTrip(state(entries, { '@gone': NOW - 3 }));
    expect(back.entries).toEqual(
      expect.arrayContaining([
        { channelId: ID, handle: '@SanDiegoZoo', at: NOW - 1 },
        { handle: '@김무식-i9t', at: NOW - 2, until: NOW + 1000 },
        { channelId: OTHER_ID },
      ]),
    );
    expect(back.entries).toHaveLength(3);
    expect(back.removed).toEqual({ '@gone': NOW - 3 });
  });

  it('저장된 순서가 달라도 같은 sync 모양이 나온다. 다르면 두 PC가 서로 덮어쓰기를 되풀이한다', () => {
    const entries = channels(40, (i) => NOW - (i % 7));
    const a = packState(state(entries, { x: 1, y: 2 }));
    const b = packState(state([...entries].reverse(), { y: 2, x: 1 }));
    expect(JSON.stringify(b.buckets)).toBe(JSON.stringify(a.buckets));
  });

  it('빈 키는 null이다', () => {
    const { buckets } = packState(state());
    expect(buckets).toHaveLength(BUCKET_COUNT);
    expect(buckets.every((b) => b === null)).toBe(true);
  });

  it('공간이 모자라면 오래전에 차단한 것부터 빠진다', () => {
    const entries = channels(30);
    const { status } = packState(state(entries));
    const budget = Math.floor(status.usedBytes * 0.6);
    const packed = packState(state(entries), budget);
    const synced = unpackBuckets(packed.buckets).entries;
    expect(packed.status.unsynced).toBeGreaterThan(0);
    expect(synced.length + packed.status.unsynced).toBe(30);
    // 담긴 것은 모두 빠진 것보다 나중에 차단한 것이다
    const oldestSynced = Math.min(...synced.map((e) => e.at!));
    const unsynced = entries.filter((e) => !synced.some((s) => s.channelId === e.channelId));
    expect(Math.max(...unsynced.map((e) => e.at!))).toBeLessThan(oldestSynced);
    expect(packed.status.usedBytes).toBeLessThanOrEqual(budget);
  });

  it('크롬처럼 시각을 지수 표기로 세어 용량을 잰다', () => {
    const at = 1_794_501_596_429;
    const { buckets, status } = packState(state([{ channelId: ID, handle: '@a', at }]));
    const index = buckets.findIndex((b) => b !== null);
    // 크롬은 1794501596429를 1.794501596429e+12로 적어서 센다(실측)
    const item = `["${ID}","@a",1.794501596429e+12]`;
    expect(status.usedBytes).toBe(bucketKey(index).length + '{"e":[],"r":[]}'.length + item.length + 1);
  });

  it('기본 한도에 경위 없는 항목이 1,000개 넘게 들어간다', () => {
    const packed = packState(state(channels(1000)));
    expect(packed.status.unsynced).toBe(0);
    // 키 하나 8KB 한도. 크롬처럼 큰 수를 지수 표기로 바꿔 센다.
    const chromeJson = (value: unknown) =>
      JSON.stringify(value).replace(/\d{10,}/g, (n) => Number(n).toExponential());
    for (const [i, bucket] of packed.buckets.entries()) {
      const bytes = bucketKey(i).length + new TextEncoder().encode(chromeJson(bucket)).length;
      expect(bytes).toBeLessThanOrEqual(8192);
    }
  });

  it('모양이 맞지 않는 값은 버린다', () => {
    const back = unpackBuckets([
      null,
      'x',
      { e: [[ID, '', 'soon'], ['', '', 1], [ID, '@a', 5, -1], 'x', [ID, '@a', 5]] },
      { r: [['', 1], ['k', Number.NaN], ['k2', 7]] },
    ]);
    expect(back).toEqual(state([{ channelId: ID, handle: '@a', at: 5 }], { k2: 7 }));
  });
});

describe('syncWarning', () => {
  it('90%부터 안내하고, 빠진 항목이 있으면 그 수를 알린다', () => {
    expect(syncWarning(null)).toBeNull();
    expect(syncWarning({ usedBytes: 89, budgetBytes: 100, unsynced: 0 })).toBeNull();
    expect(syncWarning({ usedBytes: 93, budgetBytes: 100, unsynced: 0 })).toEqual({ kind: 'near', percent: 93 });
    expect(syncWarning({ usedBytes: 99, budgetBytes: 100, unsynced: 4 })).toEqual({ kind: 'over', unsynced: 4 });
  });
});
