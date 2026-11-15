import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { browser } from '#imports';
import DurationField from '@/components/DurationField';
import Logo from '@/components/Logo';
import Segmented from '@/components/Segmented';
import Switch from '@/components/Switch';
import { DISPLAY_MODE_OPTIONS, displayModeLabel } from '@/components/displayModes';
import { useSettings } from '@/hooks/useSettings';
import { formatDuration } from '@/utils/duration';
import type { DisplayMode, Settings, SettingsPatch } from '@/utils/settings';
import CommentSample, { Comment, type SampleComment } from './CommentSample';
import { enter, leave, playHowTo, prefersReducedMotion, usePrefersReducedMotion } from './motion';
import './App.css';

const STEP_COUNT = 4;

// 예시 댓글. 실제 사람과 상관없는 지어낸 것이다. 사람이 쓴 댓글을 흉내 낸 것이라 UI 말투(명사형)를 따르지 않는다.
const BEFORE: SampleComment = {
  handle: '@movie_fan_22',
  time: '3시간 전',
  text: '연출이 정말 좋았어요. 마지막 10분은 숨도 못 쉬고 봤네요.',
  likes: '1.2천',
};
const AFTER: SampleComment = {
  handle: '@daily_watcher',
  time: '1일 전',
  text: '이 채널 영상은 늘 편집이 깔끔해서 좋아요.',
  likes: '342',
};
const SPOILER: SampleComment = {
  handle: '@결말요약봇',
  time: '5시간 전',
  text: '결말 스포 주의) 마지막 장면에서 결국 둘이 헤어지고 주인공은 혼자 떠나요.',
  likes: '3',
};
const SPOILER_REPLIES: SampleComment[] = [
  { handle: '@스포싫어', time: '4시간 전', text: '스포 좀 하지 마세요… 아직 안 봤는데', likes: '58' },
  { handle: '@popcorn_time', time: '4시간 전', text: '이런 댓글은 안 보였으면 좋겠어요', likes: '21' },
];
const HEATED: SampleComment = {
  handle: '@heated_debater',
  time: '2시간 전',
  text: '이 영상 보고도 그렇게 생각하면 진짜 답이 없네요. 다들 제대로 보긴 한 거예요?',
  likes: '12',
};
const HEATED_REPLIES: SampleComment[] = [
  { handle: '@calm_viewer', time: '1시간 전', text: '그렇게까지 말할 일은 아닌 것 같은데요', likes: '40' },
  { handle: '@popcorn_time', time: '1시간 전', text: '또 시작이네…', likes: '9' },
];

/**
 * 첫 사용 안내. 설치하면 백그라운드가 탭 하나로 연다. 차단하는 법을 보여 주고, 표시 방법·기간·답글 범위를 예시 댓글을 보며 고르게 한다.
 * 고른 값은 팝업처럼 바로 저장한다. 건너뛰면 그때까지 고른 것과 나머지 기본값이 남는다. 나중에는 팝업에서 바꾼다.
 */
export default function App() {
  const { settings, update } = useSettings();
  const dark = usePrefersDark();
  const [step, setStep] = useState(0);
  // 지금 쪽이 담긴 요소. 쪽을 넘길 때 이것이 사라지고, 다음 쪽의 새 요소가 나타난다.
  const frameRef = useRef<HTMLDivElement>(null);
  // 지금 쪽이 사라지는 중이면 참. 그동안 또 누른 것은 무시한다.
  const turning = useRef(false);
  // 이 안내에서 고른 표시 방법. 저장된 설정과 달리 처음에는 아무것도 고르지 않은 상태로 시작한다.
  // 고르는 순간 예시 댓글이 실제로 차단될 때처럼 움직이게 하려는 것이다. 고르지 않고 넘어가면 저장된 설정이 그대로 남는다.
  const [chosen, setChosen] = useState<Record<'permanent' | 'temporary', DisplayMode | null>>({
    permanent: null,
    temporary: null,
  });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const turned = useRef(false);

  useEffect(() => {
    // 쪽을 넘겼을 때만. 스크린 리더가 새 쪽의 제목부터 읽게 한다. 처음 열 때는 페이지 맨 위에서 시작한다.
    if (turned.current) headingRef.current?.focus();
  }, [step]);

  useLayoutEffect(() => {
    // 새 쪽이 화면에 그려지기 전에 나타나는 움직임을 건다. 처음 열 때는 움직이지 않는다.
    if (turned.current && !prefersReducedMotion() && frameRef.current) enter(frameRef.current);
  }, [step]);

  const go = async (next: number) => {
    if (turning.current) return;
    turning.current = true;
    turned.current = true;
    if (!prefersReducedMotion() && frameRef.current) await leave(frameRef.current);
    setStep(next);
    window.scrollTo({ top: 0 });
    turning.current = false;
  };

  const choose = (kind: 'permanent' | 'temporary', mode: DisplayMode) => {
    setChosen((current) => ({ ...current, [kind]: mode }));
    void update({ display: { [kind]: mode } });
  };

  return (
    <>
      <header className="page-bar">
        <Logo />
        <span className="wordmark mono">CleanTube</span>
        <span className="muted" aria-hidden="true">
          /
        </span>
        <h1>시작하기</h1>
      </header>

      {!settings ? (
        <main className="onboarding muted">불러오는 중…</main>
      ) : (
        <main className="onboarding">
          <div className="progress">
            <span className="mono">
              {step + 1}/{STEP_COUNT}
            </span>
            <div
              className="progress-steps"
              style={{ gridTemplateColumns: `repeat(${STEP_COUNT}, minmax(0, 1fr))` }}
              aria-hidden="true"
            >
              {Array.from({ length: STEP_COUNT }, (_, i) => (
                <span key={i} className={i <= step ? 'done' : undefined} />
              ))}
            </div>
          </div>

          {/* 쪽마다 새 요소로 만든다. 사라지게 붙잡아 둔 이전 쪽의 상태를 들고 오지 않게 */}
          <div key={step} ref={frameRef} className="step-frame">
          {step === 0 && (
            <section className="step">
              <h2 ref={headingRef} tabIndex={-1}>
                차단하는 법
              </h2>
              <p className="lead">댓글에 마우스 올리기 → 오른쪽 CleanTube 버튼 → 영구 차단 또는 임시 차단</p>
              <ul className="notes muted">
                <li>차단한 작성자의 댓글은 그다음부터 어느 영상에서든 가림</li>
                <li>영구 차단은 직접 풀 때까지, 임시 차단은 정한 기간이 지나면 저절로 풀림</li>
              </ul>
              <HowToBlock dark={dark} durationMs={settings.temporaryDurationMs} />
            </section>
          )}

          {step === 1 && (
            <ModeStep
              kind="permanent"
              title="영구 차단 표시 방법"
              lead="스팸, 스포일러처럼 다시 볼 일 없는 작성자용 · 직접 풀 때까지 유지"
              blocked={SPOILER}
              replies={SPOILER_REPLIES}
              chosen={chosen.permanent}
              onChoose={(mode) => choose('permanent', mode)}
              settings={settings}
              update={update}
              headingRef={headingRef}
            />
          )}

          {step === 2 && (
            <ModeStep
              kind="temporary"
              title="임시 차단 기간과 표시 방법"
              lead="말다툼 중인 사람처럼 잠깐만 안 보고 싶은 작성자용 · 정한 기간이 지나면 저절로 풀림"
              blocked={HEATED}
              replies={HEATED_REPLIES}
              chosen={chosen.temporary}
              onChoose={(mode) => choose('temporary', mode)}
              settings={settings}
              update={update}
              headingRef={headingRef}
            />
          )}

          {step === 3 && (
            <section className="step">
              <h2 ref={headingRef} tabIndex={-1}>
                준비 완료
              </h2>
              <dl className="summary">
                <dt>
                  <span className="kind-mark" />
                  영구 차단
                </dt>
                <dd>{displayModeLabel(settings.display.permanent)}</dd>
                <dt className="temporary">
                  <span className="kind-mark" />
                  임시 차단
                </dt>
                <dd>
                  <span className="mono">{formatDuration(settings.temporaryDurationMs)}</span> ·{' '}
                  {displayModeLabel(settings.display.temporary)}
                </dd>
                <dt>답글</dt>
                <dd>{repliesSummary(settings)}</dd>
              </dl>
              <p className="muted">나중에 바꾸려면 툴바의 CleanTube 아이콘 → 팝업</p>
            </section>
          )}
          </div>

          <nav className="step-nav" aria-label="안내 쪽 넘기기">
            {step < STEP_COUNT - 1 && (
              <button type="button" className="skip" onClick={closeTab}>
                건너뛰기
              </button>
            )}
            {step > 0 && (
              <button type="button" onClick={() => void go(step - 1)}>
                이전
              </button>
            )}
            {step < STEP_COUNT - 1 ? (
              <button type="button" className="primary" onClick={() => void go(step + 1)}>
                다음
              </button>
            ) : (
              <a className="button primary" href="https://www.youtube.com">
                유튜브로 가기
              </a>
            )}
          </nav>
        </main>
      )}
    </>
  );
}

/**
 * 댓글에 커서가 다가가면 CleanTube 버튼이 나타나고, 버튼을 누르면 메뉴가 열리는 장면. 몇 초마다 되풀이한다. 움직임은 motion.ts의 playHowTo.
 * 움직임 줄이기를 켠 사람에게는 메뉴가 열린 정지 화면을 보인다(aria-expanded로 style.css가 버튼을 보이게 하고, 커서는 CSS가 감춘다).
 * 설명은 위 글이 하므로 그림은 스크린 리더와 탭 이동에서 뺀다.
 */
function HowToBlock({ dark, durationMs }: { dark: boolean; durationMs: number }) {
  const sceneRef = useRef<HTMLElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useLayoutEffect(() => {
    if (reducedMotion || !sceneRef.current) return;
    return playHowTo(sceneRef.current);
  }, [reducedMotion]);

  return (
    <section ref={sceneRef} className="yt-sample how" aria-hidden="true" inert>
      <span className="yt-sample-tag">예시</span>
      <div className="yt-thread">
        <Comment
          comment={HEATED}
          trailing={
            <div className="yt-menu-slot">
              {/* 아이콘은 youtube.content/menu.ts의 ICON과 같은 그림이다 */}
              <button type="button" data-cleantube-trigger="" aria-expanded="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M6.5 6.5l11 11" stroke="currentColor" strokeWidth="2" />
                </svg>
              </button>
              {/* 로그인하면 우리 버튼 오른쪽에 유튜브의 ⋮가 있다 */}
              <svg className="yt-kebab" viewBox="0 0 24 24">
                <circle cx="12" cy="5.5" r="1.6" />
                <circle cx="12" cy="12" r="1.6" />
                <circle cx="12" cy="18.5" r="1.6" />
              </svg>
              <div className={dark ? 'menu dark' : 'menu'}>
                <div className="who">{HEATED.handle}</div>
                <button type="button">영구 차단</button>
                <button type="button">임시 차단 · {formatDuration(durationMs)}</button>
              </div>
            </div>
          }
        />
      </div>
      {/* 화살표 끝이 (2, 1)에 있다. motion.ts가 그만큼 당겨 끝이 가리키는 곳에 오게 한다 */}
      <svg className="how-cursor" viewBox="0 0 20 20">
        <path d="M2 1v15l4-4 3 7 2.2-1-3-6.8h5.8z" />
      </svg>
    </section>
  );
}

/** 영구 차단이나 임시 차단의 표시 방법을 고르는 쪽. 임시면 기간도 고른다. 답글 범위 스위치는 흐리게·문구로 바꾸기일 때만 나온다. */
function ModeStep(props: {
  kind: 'permanent' | 'temporary';
  title: string;
  lead: string;
  blocked: SampleComment;
  replies: SampleComment[];
  /** 이 안내에서 고른 표시 방법. 아직 안 골랐으면 null이고 예시 댓글은 가려지지 않은 채다. */
  chosen: DisplayMode | null;
  onChoose: (mode: DisplayMode) => void;
  settings: Settings;
  update: (patch: SettingsPatch) => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const { kind, chosen, settings, update } = props;
  const kindName = kind === 'permanent' ? '영구 차단' : '임시 차단';
  // 답글 범위는 흐리게와 문구로 바꾸기에만 쓰인다. 스위치는 늘 자리에 두고(예시가 들썩이지 않게) 쓸 수 없을 때는 흐리게 둔다.
  const replies =
    chosen === null
      ? { disabled: true, checked: settings.coverReplies, description: '흐리게·문구로 바꾸기를 고르면 설정 가능' }
      : chosen === 'hide'
        ? { disabled: true, checked: true, description: '완전히 숨기기는 늘 답글 포함' }
        : { disabled: false, checked: settings.coverReplies, description: '영구·임시 차단 공통 설정' };

  return (
    <section className={kind === 'temporary' ? 'step temporary' : 'step'}>
      <h2 ref={props.headingRef} tabIndex={-1}>
        <span className="kind-mark" />
        {props.title}
      </h2>
      <p className="lead">{props.lead}</p>
      <div className="controls">
        {kind === 'temporary' && (
          <DurationField
            value={settings.temporaryDurationMs}
            onChange={(temporaryDurationMs) => update({ temporaryDurationMs })}
          />
        )}
        <div className="field">
          <span className="field-label">표시 방법</span>
          <Segmented
            label={`${kindName} 표시 방법`}
            options={DISPLAY_MODE_OPTIONS}
            value={chosen}
            onChange={props.onChoose}
          />
        </div>
        <Switch
          label="답글도 함께 가리기"
          description={replies.description}
          checked={replies.checked}
          disabled={replies.disabled}
          onChange={(coverReplies) => update({ coverReplies })}
        />
      </div>
      <p className="caption">
        {chosen === null
          ? `고르면 아래 예시에 바로 적용 · 고르지 않으면 지금 설정(${displayModeLabel(settings.display[kind])}) 유지`
          : caption(chosen, props.blocked.handle, settings.coverReplies)}
      </p>
      <CommentSample
        before={BEFORE}
        blocked={props.blocked}
        replies={props.replies}
        after={AFTER}
        mode={chosen}
        coverReplies={settings.coverReplies}
      />
    </section>
  );
}

function caption(mode: DisplayMode, handle: string, coverReplies: boolean): string {
  if (mode === 'hide') return `${handle}의 댓글이 답글까지 통째로 접혀 빠짐 · 그 자리에 아무것도 안 남음`;
  const look =
    mode === 'blur'
      ? '흐리게 표시 · 마우스를 올리면 "숨긴 항목 보기"'
      : '"차단된 댓글" 한 줄만 남음 · "숨긴 항목 보기"로 잠깐 열기';
  return `${look} · ${coverReplies ? '답글까지 가림' : '답글은 그대로'}`;
}

function repliesSummary(settings: Settings): string {
  const { permanent, temporary } = settings.display;
  if (permanent === 'hide' && temporary === 'hide') return '완전히 숨기기라 늘 함께 숨김';
  return settings.coverReplies ? '함께 가림' : '그대로 둠';
}

/** 건너뛰기. 이 탭을 닫는다. 확장이 연 탭이라 window.close()가 아니라 tabs로 닫는다. */
async function closeTab() {
  const tab = await browser.tabs.getCurrent();
  if (tab?.id !== undefined) await browser.tabs.remove(tab.id);
}

/**
 * 예시 댓글의 테마. style.css와 menu.css는 유튜브처럼 <html dark>와 .dark로 어두운 테마를 받는다.
 * 유튜브의 테마는 알 수 없어서 브라우저 테마를 따른다.
 */
function usePrefersDark(): boolean {
  const [dark, setDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  useEffect(() => {
    document.documentElement.toggleAttribute('dark', dark);
  }, [dark]);
  return dark;
}
