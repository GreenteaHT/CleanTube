/**
 * 두 콘텐츠 스크립트(격리 세계, 페이지 세계)가 같이 쓰는 약속.
 * 페이지 세계에는 확장기능 API가 없으므로 여기서 storage나 WXT를 import하지 않는다.
 */

/** 개별 댓글. 최상위 댓글과 답글 모두 해당. ytd-comment-renderer는 구형 마크업. */
export const COMMENT_SELECTOR = 'ytd-comment-view-model, ytd-comment-renderer';

/** 페이지 세계 스크립트가 댓글 요소에 적어 두는 작성자의 채널 ID. */
export const CHANNEL_ID_ATTR = 'data-cleantube-channel-id';

/** 격리 세계 스크립트가 스캔 직전에 document에 쏘는 이벤트. 받은 쪽은 CHANNEL_ID_ATTR을 최신으로 맞춘다. */
export const CHANNEL_ID_REQUEST = 'cleantube:channel-id-request';
