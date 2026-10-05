import { storage } from '#imports';

export interface Settings {
  /** 댓글을 숨길 작성자. @핸들(대소문자와 앞의 @ 무시) 또는 UC로 시작하는 채널 ID. 정확히 일치 */
  blockedAuthors: string[];
  /** 유튜브 화면 오른쪽에 읽은 댓글 목록과 차단 버튼을 띄운다. 채널 ID를 손으로 복사하지 않아도 되게. */
  debugPanel: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  blockedAuthors: [],
  debugPanel: false,
};

/**
 * 'sync:' 접두사 = chrome.storage.sync. 같은 크롬 계정의 다른 기기와 동기화된다.
 * 팝업과 콘텐츠 스크립트가 이 하나를 공유하고,
 * watch()로 변경을 구독하면 어느 쪽에서 바꿔도 즉시 반영된다.
 *
 * 전에 저장된 객체에는 나중에 추가한 필드가 없을 수 있다. fallback은 값이 통째로 없을 때만 쓰이므로
 * 읽는 쪽에서 DEFAULT_SETTINGS 위에 덮어 쓴다.
 */
export const settingsItem = storage.defineItem<Settings>('sync:settings', {
  fallback: DEFAULT_SETTINGS,
});

export async function loadSettings(): Promise<Settings> {
  return withDefaults(await settingsItem.getValue());
}

export function withDefaults(value: Partial<Settings> | null | undefined): Settings {
  return { ...DEFAULT_SETTINGS, ...value };
}
