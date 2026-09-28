import { storage } from '#imports';

export type HideMode = 'hide' | 'blur';

export interface Settings {
  /** 전체 켜기/끄기 */
  enabled: boolean;
  /** hide: display none, blur: 흐리게 처리하고 마우스를 올리면 보임 */
  mode: HideMode;
  /** 영상 제목이나 댓글 본문에 포함되면 숨김 (대소문자 무시, 부분 일치) */
  keywords: string[];
  /** 채널명 또는 @핸들 (대소문자 무시, 정확히 일치) */
  channels: string[];
  /** 댓글 섹션 전체 숨기기 */
  hideAllComments: boolean;
  /** 쇼츠 카드와 쇼츠 선반 숨기기 */
  hideShorts: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  mode: 'hide',
  keywords: [],
  channels: [],
  hideAllComments: false,
  hideShorts: false,
};

/**
 * 'sync:' 접두사 = chrome.storage.sync. 같은 크롬 계정의 다른 기기와 동기화된다.
 * 팝업, 옵션, 콘텐츠 스크립트가 전부 이 하나를 공유하고,
 * watch()로 변경을 구독하면 어느 쪽에서 바꿔도 즉시 반영된다.
 */
export const settingsItem = storage.defineItem<Settings>('sync:settings', {
  fallback: DEFAULT_SETTINGS,
});
