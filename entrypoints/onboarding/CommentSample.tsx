import { useLayoutEffect, useRef } from 'react';
import { Comment } from '@/components/YoutubeComment';
import { applyDisplay } from '@/entrypoints/youtube.content/display';
import { useI18n } from '@/hooks/useI18n';
import type { SampleComment } from '@/locales/en';
import type { DisplayMode } from '@/utils/settings';

/**
 * 유튜브 댓글란을 흉내 낸 예시. 가운데 스레드가 차단된 작성자의 것이다.
 * 가리는 일은 콘텐츠 스크립트의 applyDisplay(youtube.content/display.ts)가 유튜브에서와 똑같이 한다. 모양은 style.css 그대로다.
 * 그래서 표시 방법을 고르거나 바꾸면 실제로 차단했을 때처럼 접히고 흐려지고 바뀐다. "숨긴 항목 보기"도 눌러 볼 수 있다.
 * mode가 null이면 아직 고르지 않은 것이라 아무것도 가리지 않는다.
 */
export default function CommentSample(props: {
  before: SampleComment;
  blocked: SampleComment;
  replies: SampleComment[];
  after: SampleComment;
  mode: DisplayMode | null;
  coverReplies: boolean;
}) {
  const { t, locale } = useI18n();
  const { mode, coverReplies } = props;
  const sectionRef = useRef<HTMLElement>(null);
  const commentRef = useRef<HTMLElement>(null);
  const shown = useRef(false);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const comment = commentRef.current;
    if (!section || !comment) return;
    if (!shown.current) {
      // 아무것도 가리지 않은 처음이 가장 길다. 그 높이를 붙잡아 두면 댓글이 접혀도 예시 아래가 들썩이지 않는다.
      section.style.minHeight = `${section.offsetHeight}px`;
    }
    // 처음 그릴 때(이전 쪽에서 돌아왔을 때)는 고른 모습으로 바로, 그다음부터는 유튜브에서 차단할 때처럼 움직인다
    applyDisplay(comment, mode ? { key: props.blocked.handle, mode } : null, {
      coverReplies,
      animate: shown.current,
      text: t.overlay,
      lang: locale,
    });
    shown.current = true;
    // 언어가 바뀌면 이 예시는 새로 만들어지므로(App의 key) 가림막 글은 따로 볼 것이 없다
  }, [mode, coverReplies, props.blocked.handle, t.overlay, locale]);

  return (
    <section ref={sectionRef} className="yt-sample" aria-label={t.onboarding.exampleLabel}>
      <span className="yt-sample-tag">{t.onboarding.example}</span>
      <ytd-comment-thread-renderer className="yt-thread">
        <Comment comment={props.before} />
      </ytd-comment-thread-renderer>
      <ytd-comment-thread-renderer className="yt-thread">
        <Comment comment={props.blocked} commentRef={commentRef} />
        <ytd-comment-replies-renderer className="yt-replies">
          {props.replies.map((reply) => (
            <Comment key={reply.handle} comment={reply} reply />
          ))}
        </ytd-comment-replies-renderer>
      </ytd-comment-thread-renderer>
      <ytd-comment-thread-renderer className="yt-thread">
        <Comment comment={props.after} />
      </ytd-comment-thread-renderer>
    </section>
  );
}
