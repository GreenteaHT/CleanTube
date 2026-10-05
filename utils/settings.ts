import { storage } from '#imports';
import { DAY_MS } from './duration';

/** 차단 목록은 여기 없다. 커질 수 있어서 utils/blocklist.ts가 storage.local에 따로 둔다. */
export interface Settings {
  /** 유튜브 화면 오른쪽에 읽은 댓글 목록과 차단 버튼을 띄운다. 채널 ID를 손으로 복사하지 않아도 되게. */
  debugPanel: boolean;
  /** 댓글 메뉴의 "임시 차단"을 눌렀을 때 차단하는 기간(ms). 이미 걸어 둔 임시 차단의 기간은 바뀌지 않는다. */
  temporaryDurationMs: number;
}

export const DEFAULT_SETTINGS: Settings = {
  debugPanel: false,
  temporaryDurationMs: 7 * DAY_MS,
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
