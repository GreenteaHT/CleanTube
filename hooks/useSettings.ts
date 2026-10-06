import { useCallback, useEffect, useState } from 'react';
import {
  loadSettings,
  updateSettings,
  watchSettings,
  type Settings,
  type SettingsPatch,
} from '@/utils/settings';

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
    const unwatch = watchSettings(setSettings);
    return () => {
      alive = false;
      unwatch();
    };
  }, []);

  // 구독으로도 같은 값이 오지만, 저장이 끝나는 대로 바로 그린다
  const update = useCallback(async (patch: SettingsPatch) => {
    setSettings(await updateSettings(patch));
  }, []);

  return { settings, update };
}
