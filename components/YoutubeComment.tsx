import type { DetailedHTMLProps, HTMLAttributes, ReactNode, Ref } from 'react';
import { useI18n } from '@/hooks/useI18n';
import type { SampleComment } from '@/locales/en';
import './YoutubeComment.css';

// 예시 댓글은 유튜브와 같은 태그 이름으로 그린다. display.ts가 이 이름으로 스레드와 답글 묶음을 찾는다.
type YoutubeElement = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'ytd-comment-thread-renderer': YoutubeElement;
      'ytd-comment-view-model': YoutubeElement;
      'ytd-comment-replies-renderer': YoutubeElement;
    }
  }
}

/**
 * 유튜브 댓글 하나를 흉내 낸 것. 첫 사용 안내의 예시 댓글과 팝업의 표시 방법 미리보기가 같이 쓴다.
 * display.ts가 가림막을 이 요소의 첫 자식으로 넣는다. trailing은 오른쪽 끝(메뉴 버튼 자리).
 * compact면 좋아요·답글 줄을 빼고 작게 그린다(크기는 쓰는 쪽 CSS). 팝업처럼 자리가 좁을 때.
 */
export function Comment(props: {
  comment: SampleComment;
  reply?: boolean;
  compact?: boolean;
  commentRef?: Ref<HTMLElement>;
  trailing?: ReactNode;
}) {
  const { t } = useI18n();
  const { comment } = props;
  return (
    <ytd-comment-view-model ref={props.commentRef} className={props.reply ? 'yt-comment reply' : 'yt-comment'}>
      <div className="yt-row">
        <span className="yt-avatar" style={{ background: avatarColor(comment.handle) }} aria-hidden="true">
          {comment.handle.replace(/^@/, '').charAt(0).toUpperCase()}
        </span>
        <div className="yt-body">
          <div className="yt-meta">
            <span className="yt-handle">{comment.handle}</span>
            <span className="yt-time">{comment.time}</span>
          </div>
          <p className="yt-text">{comment.text}</p>
          {!props.compact && (
            <div className="yt-actions" aria-hidden="true">
              <ThumbIcon />
              <span>{comment.likes}</span>
              <ThumbIcon down />
              <span className="yt-reply-button">{t.onboarding.reply}</span>
            </div>
          )}
        </div>
        {props.trailing}
      </div>
    </ytd-comment-view-model>
  );
}

function ThumbIcon({ down = false }: { down?: boolean }) {
  return (
    <svg className="yt-thumb" viewBox="0 0 24 24" style={down ? { transform: 'rotate(180deg)' } : undefined}>
      <path d="M7.5 10.5v9h-3v-9zM9.5 19.5h7.6a2 2 0 0 0 2-1.6l1.1-5.6a2 2 0 0 0-2-2.3h-4.4l.7-3.4a1.5 1.5 0 0 0-2.7-1.2L9.5 10.5z" />
    </svg>
  );
}

// 유튜브의 기본 프로필 그림처럼 이름 첫 글자를 색 원에 얹는다. 같은 이름이면 같은 색.
const AVATAR_COLORS = ['#5b7f95', '#9a6b4f', '#6f8a5a', '#8a5a7a', '#4f6fa8', '#a0704a'];

function avatarColor(handle: string): string {
  let sum = 0;
  for (const ch of handle) sum += ch.codePointAt(0) ?? 0;
  return AVATAR_COLORS[sum % AVATAR_COLORS.length] ?? '#5b7f95';
}
