import { useEffect, useLayoutEffect, useRef } from 'react';
import DurationField from '@/components/DurationField';
import Logo from '@/components/Logo';
import Segmented from '@/components/Segmented';
import Switch from '@/components/Switch';
import { Comment } from '@/components/YoutubeComment';
import { displayModeOptions } from '@/components/displayModes';
import { applyDisplay } from '@/entrypoints/youtube.content/display';
import { useBlocked } from '@/hooks/useBlocked';
import { useI18n } from '@/hooks/useI18n';
import { usePrefersDark } from '@/hooks/usePrefersDark';
import { useSettings } from '@/hooks/useSettings';
import { useSyncWarning } from '@/hooks/useSyncWarning';
import { useUnpacked } from '@/hooks/useUnpacked';
import { isExpired } from '@/utils/matcher';
import type { DisplayMode } from '@/utils/settings';
import { openSettings } from './openSettings';
import './App.css';

type Kind = 'permanent' | 'temporary';

/**
 * 툴바 아이콘을 눌렀을 때 뜨는 팝업. 맨 위 줄의 차단 기능 스위치, 차단한 수, 영구/임시 차단 설정(표시 방법, 답글 범위, 임시는 기간).
 * 압축해제로 올렸을 때만 맨 위 줄에 디버그 패널 버튼이 있다. 개발하면서 쓰는 것이라 스토어 사용자에게는 보이지 않는다.
 * 차단 목록과 언어는 여기 없고 설정 페이지(entrypoints/options)의 두 탭에 있다. 팝업에는 그 탭을 여는 버튼만 둔다.
 * "차단 목록 관리"는 차단 목록 탭, 맨 위 줄의 "설정"은 언어 탭을 연다. 진입로가 차단 목록 하나뿐이면 다른 설정을 찾을 길이 없어서.
 */
export default function App() {
  const { t } = useI18n();
  const { settings, update } = useSettings();
  const { blocked } = useBlocked();
  const syncWarning = useSyncWarning();
  const unpacked = useUnpacked();
  usePrefersDark();

  useEffect(() => {
    document.title = 'CleanTube';
  }, []);

  if (!settings || !blocked) return <div className="popup loading muted">{t.common.loading}</div>;

  const modeField = (kind: Kind) => (
    <ModeField
      kind={kind}
      mode={settings.display[kind]}
      coverReplies={settings.coverReplies[kind]}
      onMode={(mode) => update({ display: { [kind]: mode } })}
      onCoverReplies={(checked) => update({ coverReplies: { [kind]: checked } })}
    />
  );

  // 만료된 임시 차단은 다음에 목록을 쓸 때 지워진다. 그 전에도 세지 않아야 차단 목록 페이지의 수와 같다.
  const now = Date.now();
  const blockedCount = blocked.filter((e) => !isExpired(e, now)).length;

  return (
    <div className="popup">
      <header className="bar">
        <Logo />
        <span className="wordmark mono">CleanTube</span>
        {unpacked && (
          <button
            type="button"
            className="debug"
            aria-label={t.popup.debugPanel}
            title={t.popup.debugPanel}
            aria-pressed={settings.debugPanel}
            onClick={() => update({ debugPanel: !settings.debugPanel })}
          >
            {/* 벌레 */}
            <svg className="icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <rect x="4.5" y="4.5" width="5" height="7.5" rx="2.5" />
              <path d="M5.5 4.5a1.5 1.5 0 0 1 3 0M7 7v5M2 6.5h2.5M9.5 6.5H12M2.5 10h2M9.5 10h2" />
            </svg>
          </button>
        )}
        <button type="button" className="open-settings" onClick={() => void openSettings('language')}>
          <svg className="icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M2 3.5h3M8 3.5h4M2 7h6M11 7h1M2 10.5h1M6 10.5h6" />
            <circle cx="6.5" cy="3.5" r="1.5" />
            <circle cx="9.5" cy="7" r="1.5" />
            <circle cx="4.5" cy="10.5" r="1.5" />
          </svg>
          {t.settings.title}
        </button>
        <Switch
          label={t.popup.enabled}
          description={t.popup.enabledHint}
          checked={settings.enabled}
          onChange={(enabled) => update({ enabled })}
          hideText
        />
      </header>

      <section className="total">
        <p className="count">
          <span className="num mono">{blockedCount}</span>
          <span className="unit">{t.common.blockedCount}</span>
        </p>
        {/* 이미 열려 있으면 새 탭을 만들지 않고 그 탭으로 간다 */}
        <button type="button" className="open-list" onClick={() => void openSettings('blockList')}>
          {t.popup.manageList}
          <svg className="icon" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M4.5 2.5h5v5M9.5 2.5L3 9" />
          </svg>
        </button>
      </section>
      {syncWarning && (
        <p className="notice">
          {syncWarning.kind === 'over'
            ? t.sync.overShort(syncWarning.unsynced)
            : t.sync.nearShort(syncWarning.percent)}
        </p>
      )}

      <section className="kind">
        <h2>
          <span className="kind-mark" />
          {t.common.permanent}
        </h2>
        {modeField('permanent')}
      </section>

      <section className="kind temporary">
        <h2>
          <span className="kind-mark" />
          {t.common.temporary}
        </h2>
        <DurationField
          value={settings.temporaryDurationMs}
          onChange={(temporaryDurationMs) => update({ temporaryDurationMs })}
        />
        {modeField('temporary')}
        <p className="muted">{t.popup.durationNote}</p>
      </section>
    </div>
  );
}

/** 표시 방법과 답글 범위. 답글 스위치는 "기간" 줄의 직접 입력처럼 이름표 줄 오른쪽에 둔다. 팝업 높이를 늘리지 않으려고. */
function ModeField(props: {
  kind: Kind;
  mode: DisplayMode;
  coverReplies: boolean;
  onMode: (mode: DisplayMode) => void;
  onCoverReplies: (checked: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const hide = props.mode === 'hide';
  return (
    <div className="field">
      <div className="field-head">
        <span className="field-label">{t.common.display}</span>
        {/* 답글 범위는 흐리게와 문구로 바꾸기에만 쓰인다. 완전히 숨기기는 늘 답글째라 켜진 채 흐리게 둔다(첫 사용 안내와 같다) */}
        <Switch
          compact
          label={t.popup.coverReplies}
          description={t.popup.coverRepliesHint}
          checked={hide || props.coverReplies}
          disabled={hide}
          onChange={props.onCoverReplies}
        />
      </div>
      <Segmented
        label={t.common.displayOf(props.kind === 'permanent' ? t.common.permanent : t.common.temporary)}
        options={displayModeOptions(t)}
        value={props.mode}
        onChange={props.onMode}
      />
      {/* 언어가 바뀌면 글의 길이가 달라져서 새로 만들어 높이를 다시 잰다 */}
      <ModePreview key={locale} kind={props.kind} mode={props.mode} coverReplies={props.coverReplies} />
    </div>
  );
}

/**
 * 고른 표시 방법으로 댓글이 유튜브에서 어떻게 보이는지. 첫 사용 안내의 예시처럼 유튜브와 같은 태그로 댓글 하나와 답글 하나를 작게 그리고,
 * 콘텐츠 스크립트의 applyDisplay와 style.css로 가린다. 그래서 표시 방법이나 답글 스위치를 바꾸면 유튜브에서처럼 접히고 흐려지고 바뀐다.
 * 고른 칸과 스위치를 거드는 그림이라 스크린 리더와 탭 이동에서 뺀다. 예시 글은 첫 사용 안내와 같은 것(영구는 스포일러, 임시는 말다툼).
 */
function ModePreview(props: { kind: Kind; mode: DisplayMode; coverReplies: boolean }) {
  const { t, locale } = useI18n();
  const { mode, coverReplies } = props;
  const boxRef = useRef<HTMLDivElement>(null);
  const commentRef = useRef<HTMLElement>(null);
  const shown = useRef(false);
  const sample = props.kind === 'permanent' ? t.samples.spoiler : t.samples.heated;
  const replies = (props.kind === 'permanent' ? t.samples.spoilerReplies : t.samples.heatedReplies).slice(0, 1);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const comment = commentRef.current;
    if (!box || !comment) return;
    // 아무것도 가리지 않은 처음이 가장 길다. 그 높이를 붙잡아 두면 접히거나 한 줄로 바뀌어도 팝업 아래가 들썩이지 않는다
    if (!shown.current) box.style.minHeight = `${box.offsetHeight}px`;
    // 팝업을 열 때는 고른 모습으로 바로, 그다음부터는 유튜브에서 차단할 때처럼 움직인다
    applyDisplay(comment, { key: sample.handle, mode }, {
      coverReplies,
      animate: shown.current,
      text: t.overlay,
      lang: locale,
    });
    shown.current = true;
  }, [mode, coverReplies, sample.handle, t.overlay, locale]);

  return (
    <div ref={boxRef} className="preview" aria-hidden="true" inert>
      <ytd-comment-thread-renderer className="yt-thread">
        <Comment comment={sample} compact commentRef={commentRef} />
        <ytd-comment-replies-renderer className="yt-replies">
          {replies.map((reply) => (
            <Comment key={reply.handle} comment={reply} reply compact />
          ))}
        </ytd-comment-replies-renderer>
      </ytd-comment-thread-renderer>
      <p className="preview-empty">{t.popup.previewHide}</p>
    </div>
  );
}
