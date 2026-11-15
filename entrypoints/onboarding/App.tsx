import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { browser } from '#imports';
import DurationField from '@/components/DurationField';
import Logo from '@/components/Logo';
import Segmented from '@/components/Segmented';
import Switch from '@/components/Switch';
import { displayModeLabel, displayModeOptions, languageOptions } from '@/components/displayModes';
import { useI18n } from '@/hooks/useI18n';
import { useSettings } from '@/hooks/useSettings';
import { formatDuration } from '@/utils/duration';
import type { LanguageSetting, Messages } from '@/utils/i18n';
import type { DisplayMode, Settings, SettingsPatch } from '@/utils/settings';
import type { SampleComment } from '@/locales/en';
import CommentSample, { Comment } from './CommentSample';
import { enter, leave, playHowTo, prefersReducedMotion, usePrefersReducedMotion } from './motion';
import './App.css';

const STEP_COUNT = 4;

/**
 * 첫 사용 안내. 설치하면 백그라운드가 탭 하나로 연다. 차단하는 법을 보여 주고, 표시 방법·기간·답글 범위를 예시 댓글을 보며 고르게 한다.
 * 고른 값은 팝업처럼 바로 저장한다. 건너뛰면 그때까지 고른 것과 나머지 기본값이 남는다. 나중에는 팝업에서 바꾼다.
 * 맨 위 줄에서 언어를 고를 수 있다. 처음에는 브라우저 언어를 따른다.
 */
export default function App() {
  const { t, locale, setting, browserLocale } = useI18n();
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
    document.title = `CleanTube · ${t.onboarding.title}`;
  }, [t]);

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

  const samples = t.samples;

  return (
    <>
      <header className="page-bar">
        <Logo />
        <span className="wordmark mono">CleanTube</span>
        <span className="muted" aria-hidden="true">
          /
        </span>
        <h1>{t.onboarding.title}</h1>
        {/* 브라우저 언어가 아닌 언어로 쓰고 싶은 사람이 처음부터 고를 수 있게. 나중에는 설정 페이지의 언어 탭에서 */}
        <label className="language-select">
          <svg className="icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="6" />
            <path d="M2 8h12M8 2c1.8 1.7 2.6 3.7 2.6 6S9.8 12.3 8 14M8 2C6.2 3.7 5.4 5.7 5.4 8s.8 4.3 2.6 6" />
          </svg>
          <select
            aria-label={t.onboarding.language}
            value={setting}
            onChange={(e) => void update({ language: e.target.value as LanguageSetting })}
          >
            {languageOptions(t, browserLocale).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      {!settings ? (
        <main className="onboarding muted">{t.common.loading}</main>
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
                  {t.onboarding.howTitle}
                </h2>
                <p className="lead">{t.onboarding.howLead}</p>
                <ul className="notes muted">
                  {t.onboarding.howNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
                <HowToBlock dark={dark} durationMs={settings.temporaryDurationMs} />
              </section>
            )}

            {step === 1 && (
              <ModeStep
                kind="permanent"
                title={t.onboarding.permanentTitle}
                lead={t.onboarding.permanentLead}
                blocked={samples.spoiler}
                replies={samples.spoilerReplies}
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
                title={t.onboarding.temporaryTitle}
                lead={t.onboarding.temporaryLead}
                blocked={samples.heated}
                replies={samples.heatedReplies}
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
                  {t.onboarding.doneTitle}
                </h2>
                <dl className="summary">
                  <dt>
                    <span className="kind-mark" />
                    {t.common.permanent}
                  </dt>
                  <dd>{displayModeLabel(settings.display.permanent, t)}</dd>
                  <dt className="temporary">
                    <span className="kind-mark" />
                    {t.common.temporary}
                  </dt>
                  <dd>
                    <span className="mono">{formatDuration(settings.temporaryDurationMs, t.common)}</span> ·{' '}
                    {displayModeLabel(settings.display.temporary, t)}
                  </dd>
                  <dt>{t.onboarding.summaryReplies}</dt>
                  <dd>{repliesSummary(settings, t)}</dd>
                </dl>
                <p className="muted">{t.onboarding.changeLater}</p>
              </section>
            )}
          </div>

          <nav className="step-nav" aria-label={t.onboarding.navLabel}>
            {step < STEP_COUNT - 1 && (
              <button type="button" className="skip" onClick={closeTab}>
                {t.onboarding.skip}
              </button>
            )}
            {step > 0 && (
              <button type="button" onClick={() => void go(step - 1)}>
                {t.onboarding.back}
              </button>
            )}
            {step < STEP_COUNT - 1 ? (
              <button type="button" className="primary" onClick={() => void go(step + 1)}>
                {t.onboarding.next}
              </button>
            ) : (
              <a className="button primary" href="https://www.youtube.com">
                {t.onboarding.goToYoutube}
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
  const { t, locale } = useI18n();
  const sceneRef = useRef<HTMLElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const heated = t.samples.heated;

  useLayoutEffect(() => {
    if (reducedMotion || !sceneRef.current) return;
    return playHowTo(sceneRef.current);
    // 언어가 바뀌면 댓글 글의 길이가 달라져 커서가 갈 자리도 바뀐다. 다시 잰다
  }, [reducedMotion, locale]);

  return (
    <section ref={sceneRef} className="yt-sample how" aria-hidden="true" inert>
      <span className="yt-sample-tag">{t.onboarding.example}</span>
      <div className="yt-thread">
        <Comment
          comment={heated}
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
                <div className="who">{heated.handle}</div>
                <button type="button">{t.youtube.blockPermanent}</button>
                <button type="button">{t.youtube.blockTemporary(formatDuration(durationMs, t.common))}</button>
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

/** 영구 차단이나 임시 차단의 표시 방법을 고르는 쪽. 임시면 기간도 고른다. */
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
  const { t, locale } = useI18n();
  const { kind, chosen, settings, update } = props;
  const kindName = kind === 'permanent' ? t.common.permanent : t.common.temporary;
  // 답글 범위는 흐리게와 문구로 바꾸기에만 쓰인다. 스위치는 늘 자리에 두고(예시가 들썩이지 않게) 쓸 수 없을 때는 흐리게 둔다.
  const replies =
    chosen === null
      ? { disabled: true, checked: settings.coverReplies, description: t.onboarding.repliesDisabled }
      : chosen === 'hide'
        ? { disabled: true, checked: true, description: t.onboarding.repliesAlways }
        : { disabled: false, checked: settings.coverReplies, description: t.onboarding.repliesShared };

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
          <span className="field-label">{t.common.display}</span>
          <Segmented
            label={t.common.displayOf(kindName)}
            options={displayModeOptions(t)}
            value={chosen}
            onChange={props.onChoose}
          />
        </div>
        <Switch
          label={t.popup.coverReplies}
          description={replies.description}
          checked={replies.checked}
          disabled={replies.disabled}
          onChange={(coverReplies) => update({ coverReplies })}
        />
      </div>
      <p className="caption">
        {chosen === null
          ? t.onboarding.unchosen(displayModeLabel(settings.display[kind], t))
          : caption(chosen, props.blocked.handle, settings.coverReplies, t)}
      </p>
      {/* 언어가 바뀌면 예시 댓글의 글과 길이가 달라져서 새로 만들어 높이를 다시 잰다. 고른 모습은 바로 다시 적용된다 */}
      <CommentSample
        key={locale}
        before={t.samples.before}
        blocked={props.blocked}
        replies={props.replies}
        after={t.samples.after}
        mode={chosen}
        coverReplies={settings.coverReplies}
      />
    </section>
  );
}

function caption(mode: DisplayMode, handle: string, coverReplies: boolean, t: Messages): string {
  if (mode === 'hide') return t.onboarding.captionHide(handle);
  const look = mode === 'blur' ? t.onboarding.captionBlur : t.onboarding.captionPlaceholder;
  return `${look} · ${coverReplies ? t.onboarding.repliesCovered : t.onboarding.repliesVisible}`;
}

function repliesSummary(settings: Settings, t: Messages): string {
  const { permanent, temporary } = settings.display;
  if (permanent === 'hide' && temporary === 'hide') return t.onboarding.summaryRepliesAlways;
  return settings.coverReplies ? t.onboarding.summaryRepliesCovered : t.onboarding.summaryRepliesVisible;
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
