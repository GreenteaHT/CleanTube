import { browser } from '#imports';
import DurationField from '@/components/DurationField';
import Logo from '@/components/Logo';
import Segmented from '@/components/Segmented';
import Switch from '@/components/Switch';
import { DISPLAY_MODE_OPTIONS } from '@/components/displayModes';
import { useBlocked } from '@/hooks/useBlocked';
import { useSettings } from '@/hooks/useSettings';
import { useSyncWarning } from '@/hooks/useSyncWarning';
import { isExpired } from '@/utils/matcher';
import type { DisplayMode } from '@/utils/settings';
import './App.css';

/**
 * 툴바 아이콘을 눌렀을 때 뜨는 팝업. 차단한 수, 영구/임시 차단 설정, 답글 범위, 디버그 패널 토글.
 * 차단 목록은 여기 없고 차단 목록 페이지(entrypoints/options)에 있다. 팝업에는 그 페이지를 여는 버튼만 둔다.
 */
export default function App() {
  const { settings, update } = useSettings();
  const { blocked } = useBlocked();
  const syncWarning = useSyncWarning();

  if (!settings || !blocked) return <div className="popup loading muted">불러오는 중…</div>;

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
          <span className="unit">명 차단 중</span>
        </p>
        {/* 이미 열려 있으면 새 탭을 만들지 않고 그 탭으로 간다 */}
        <button type="button" className="open-list" onClick={() => browser.runtime.openOptionsPage()}>
          차단 목록 관리
          <svg className="icon" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M4.5 2.5h5v5M9.5 2.5L3 9" />
          </svg>
        </button>
      </section>
      {syncWarning && (
        <p className="notice">
          {syncWarning.kind === 'over'
            ? `오래전에 차단한 ${syncWarning.unsynced}명은 다른 PC와 동기화 안 됨`
            : `동기화 공간 ${syncWarning.percent}% 사용 중`}
        </p>
      )}

      <section className="kind">
        <h2>
          <span className="kind-mark" />
          영구 차단
        </h2>
        <ModeField
          kind="영구 차단"
          value={settings.display.permanent}
          onChange={(mode) => setMode('permanent', mode)}
        />
      </section>

      <section className="kind temporary">
        <h2>
          <span className="kind-mark" />
          임시 차단
        </h2>
        <DurationField
          value={settings.temporaryDurationMs}
          onChange={(temporaryDurationMs) => update({ temporaryDurationMs })}
        />
        <ModeField
          kind="임시 차단"
          value={settings.display.temporary}
          onChange={(mode) => setMode('temporary', mode)}
        />
        <p className="muted">기간 변경은 새로 거는 임시 차단부터 적용</p>
      </section>

      <div className="switches">
        <Switch
          label="답글도 함께 가리기"
          description="흐리게·문구로 바꾸기에서도 답글까지 적용. 완전히 숨기기는 늘 답글 포함"
          checked={settings.coverReplies}
          onChange={(coverReplies) => update({ coverReplies })}
        />
        <Switch
          label="디버그 패널"
          description="유튜브 화면 오른쪽에 읽은 댓글 목록 표시"
          checked={settings.debugPanel}
          onChange={(debugPanel) => update({ debugPanel })}
        />
      </div>
    </div>
  );
}

function ModeField(props: { kind: string; value: DisplayMode; onChange: (mode: DisplayMode) => void }) {
  return (
    <div className="field">
      <span className="field-label">표시 방법</span>
      <Segmented
        label={`${props.kind} 표시 방법`}
        options={DISPLAY_MODE_OPTIONS}
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
  return (
    <div className="preview" aria-hidden="true">
      {mode === 'hide' && <span className="muted">이 자리에 아무것도 안 남음</span>}
      {mode === 'blur' && (
        <span className="blurred">
          <span className="mono">@작성자</span> 흐리게 가린 댓글 예시
        </span>
      )}
      {mode === 'placeholder' && (
        <>
          <span className="muted">차단된 댓글</span>
          <span className="pill">숨긴 항목 보기</span>
        </>
      )}
    </div>
  );
}
