import { useEffect, useState } from 'react';
import { loadSyncStatus, watchSyncStatus } from '@/utils/blocklist';
import { syncWarning, type SyncWarning } from '@/utils/blocksync';

/**
 * 차단 목록 동기화의 한도 안내. 팝업과 차단 목록 페이지가 쓴다. 띄울 게 없으면 null.
 * 상태는 백그라운드가 맞출 때마다 남긴다.
 */
export function useSyncWarning(): SyncWarning | null {
  const [warning, setWarning] = useState<SyncWarning | null>(null);

  useEffect(() => {
    let alive = true;
    loadSyncStatus().then((status) => {
      if (alive) setWarning(syncWarning(status));
    });
    const unwatch = watchSyncStatus((status) => setWarning(syncWarning(status)));
    return () => {
      alive = false;
      unwatch();
    };
  }, []);

  return warning;
}
