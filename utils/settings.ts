import { storage } from '#imports';

export interface Settings {
  /** 댓글을 숨길 작성자. @핸들 또는 채널명 (대소문자 무시, 앞의 @ 무시, 정확히 일치) */
  blockedAuthors: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  blockedAuthors: [],
};

/**
 * 'sync:' 접두사 = chrome.storage.sync. 같은 크롬 계정의 다른 기기와 동기화된다.
 * 팝업과 콘텐츠 스크립트가 이 하나를 공유하고,
 * watch()로 변경을 구독하면 어느 쪽에서 바꿔도 즉시 반영된다.
 */
export const settingsItem = storage.defineItem<Settings>('sync:settings', {
  fallback: DEFAULT_SETTINGS,
});
