import { useCallback, useEffect, useState } from 'react';
import { loadSettings, settingsItem, withDefaults, type Settings } from '@/utils/settings';

/**
 * 팝업에서 설정을 읽고 쓰는 훅.
 * storage를 직접 구독하므로 다른 창에서 바꿔도 이 컴포넌트가 같이 갱신된다.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let alive = true;
    loadSettings().then((value) => {
      if (alive) setSettings(value);
    });
    const unwatch = settingsItem.watch((next) => {
      setSettings(withDefaults(next));
    });
    return () => {
      alive = false;
      unwatch();
    };
  }, []);

  const update = useCallback(async (patch: Partial<Settings>) => {
    // 다른 창에서 바꾼 값을 덮어쓰지 않도록 최신 값을 다시 읽어 병합한다.
    const next = { ...(await loadSettings()), ...patch };
    setSettings(next);
    await settingsItem.setValue(next);
  }, []);

  return { settings, update };
}
