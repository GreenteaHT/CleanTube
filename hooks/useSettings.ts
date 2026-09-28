import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, settingsItem, type Settings } from '@/utils/settings';

/**
 * 팝업과 옵션 페이지에서 설정을 읽고 쓰는 훅.
 * storage를 직접 구독하므로 다른 창에서 바꿔도 이 컴포넌트가 같이 갱신된다.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let alive = true;
    settingsItem.getValue().then((value) => {
      if (alive) setSettings(value);
    });
    const unwatch = settingsItem.watch((next) => {
      setSettings(next ?? DEFAULT_SETTINGS);
    });
    return () => {
      alive = false;
      unwatch();
    };
  }, []);

  const update = useCallback(async (patch: Partial<Settings>) => {
    const current = await settingsItem.getValue();
    const next = { ...current, ...patch };
    setSettings(next);
    await settingsItem.setValue(next);
  }, []);

  return { settings, update };
}
