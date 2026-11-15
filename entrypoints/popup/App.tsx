import { useEffect } from 'react';
import { browser } from '#imports';
import DurationField from '@/components/DurationField';
import Logo from '@/components/Logo';
import Segmented from '@/components/Segmented';
import Switch from '@/components/Switch';
import { displayModeOptions } from '@/components/displayModes';
import { useBlocked } from '@/hooks/useBlocked';
import { useI18n } from '@/hooks/useI18n';
import { useSettings } from '@/hooks/useSettings';
import { useSyncWarning } from '@/hooks/useSyncWarning';
import { isExpired } from '@/utils/matcher';
import type { DisplayMode } from '@/utils/settings';
import './App.css';

/**
 * 툴바 아이콘을 눌렀을 때 뜨는 팝업. 차단한 수, 영구/임시 차단 설정, 답글 범위, 디버그 패널 토글.
 * 차단 목록은 여기 없고 차단 목록 페이지(entrypoints/options)에 있다. 팝업에는 그 페이지를 여는 버튼만 둔다.
 * 언어 설정도 여기 없고 그 페이지의 설정 탭에 있다.
 */
export default function App() {
  const { t } = useI18n();
  const { settings, update } = useSettings();
  const { blocked } = useBlocked();
  const syncWarning = useSyncWarning();

  useEffect(() => {
    document.title = 'CleanTube';
  }, []);

  if (!settings || !blocked) return <div className="popup loading muted">{t.common.loading}</div>;

  const setMode = (kind: 'permanent' | 'temporary', mode: DisplayMode) =>
    update({ display: { [kind]: mode } });

  // 만료된 임시 차단은 다음에 목록을 쓸 때 지워진다. 그 전에도 세지 않아야 차단 목록 페이지의 수와 같다.
  const now = Date.now();
  const blockedCount = blocked.filter((e) => !isExpired(e, now)).length;

  return (
    <div className="popup">
      <header className="bar">
        <Logo />
        <span className="wordmark mono">CleanTube</span>
      </header>

      <section className="total">
        <p className="count">
          <span className="num mono">{blockedCount}</span>
          <span className="unit">{t.common.blockedCount}</span>
        </p>
        {/* 이미 열려 있으면 새 탭을 만들지 않고 그 탭으로 간다 */}
        <button type="button" className="open-list" onClick={() => browser.runtime.openOptionsPage()}>
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
        <ModeField
          kind={t.common.permanent}
          value={settings.display.permanent}
          onChange={(mode) => setMode('permanent', mode)}
        />
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
        <ModeField
          kind={t.common.temporary}
          value={settings.display.temporary}
          onChange={(mode) => setMode('temporary', mode)}
        />
        <p className="muted">{t.popup.durationNote}</p>
      </section>

      <div className="switches">
        <Switch
          label={t.popup.coverReplies}
          description={t.popup.coverRepliesHint}
          checked={settings.coverReplies}
          onChange={(coverReplies) => update({ coverReplies })}
        />
        <Switch
          label={t.popup.debugPanel}
          description={t.popup.debugPanelHint}
          checked={settings.debugPanel}
          onChange={(debugPanel) => update({ debugPanel })}
        />
      </div>
    </div>
  );
}

function ModeField(props: { kind: string; value: DisplayMode; onChange: (mode: DisplayMode) => void }) {
  const { t } = useI18n();
  return (
    <div className="field">
      <span className="field-label">{t.common.display}</span>
      <Segmented
        label={t.common.displayOf(props.kind)}
        options={displayModeOptions(t)}
        value={props.value}
        onChange={props.onChange}
      />
      <ModePreview mode={props.value} />
    </div>
  );
}

/**
 * 고른 표시 방법으로 댓글이 유튜브에서 어떻게 보이는지 한 줄로 보여 준다. 고른 칸의 이름을 거드는 그림이라 스크린 리더에는 숨긴다.
 * 흐리게와 문구로 바꾸기의 모양은 youtube.content/style.css의 가림막을 따라 그린다.
 */
function ModePreview({ mode }: { mode: DisplayMode }) {
  const { t } = useI18n();
  return (
    <div className="preview" aria-hidden="true">
      {mode === 'hide' && <span className="muted">{t.popup.previewHide}</span>}
      {mode === 'blur' && (
        <span className="blurred">
          <span className="mono">@author</span> {t.popup.previewBlur}
        </span>
      )}
      {mode === 'placeholder' && (
        <>
          <span className="muted">{t.overlay.blocked}</span>
          <span className="pill">{t.overlay.show}</span>
        </>
      )}
    </div>
  );
}
