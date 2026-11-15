import { useEffect, useState } from 'react';
import { browser } from '#imports';

/**
 * 압축해제로 올린 확장인지. 개발하면서만 쓰는 것(팝업의 디버그 패널 버튼)을 스토어에서 설치한 사람에게는 보이지 않게 한다.
 * management.getSelf()는 management 권한 없이 쓸 수 있다. 알기 전에는 false라 보이지 않는다.
 */
export function useUnpacked(): boolean {
  const [unpacked, setUnpacked] = useState(false);
  useEffect(() => {
    void browser.management.getSelf().then((self) => setUnpacked(self.installType === 'development'));
  }, []);
  return unpacked;
}
