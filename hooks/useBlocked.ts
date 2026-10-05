import { useEffect, useState } from 'react';
import { addBlock, blockedItem, loadBlocked, removeBlock } from '@/utils/blocklist';
import type { BlockEntry } from '@/utils/matcher';

/**
 * 팝업에서 차단 목록을 읽고 쓰는 훅.
 * storage를 직접 구독하므로 유튜브 탭의 메뉴나 패널에서 바꿔도 같이 갱신된다.
 */
export function useBlocked() {
  const [blocked, setBlocked] = useState<BlockEntry[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadBlocked().then((value) => {
      if (alive) setBlocked(value);
    });
    const unwatch = blockedItem.watch((next) => setBlocked(next ?? []));
    return () => {
      alive = false;
      unwatch();
    };
  }, []);

  return { blocked, add: addBlock, remove: removeBlock };
}
