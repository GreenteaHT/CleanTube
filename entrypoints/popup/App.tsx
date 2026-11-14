import { useId, useState } from 'react';
import { browser } from '#imports';
import Logo from '@/components/Logo';
import Segmented, { type SegmentedOption } from '@/components/Segmented';
import { useBlocked } from '@/hooks/useBlocked';
import { useSettings } from '@/hooks/useSettings';
import { useSyncWarning } from '@/hooks/useSyncWarning';
import { DAY_MS, HOUR_MS, formatDuration } from '@/utils/duration';
import { isExpired } from '@/utils/matcher';
import type { DisplayMode } from '@/utils/settings';
import './App.css';

// 세 칸에 나란히 들어가야 해서 짧게 쓴다. "차단된 댓글" 글자는 아래 미리보기에 그대로 보인다.
const MODES: SegmentedOption<DisplayMode>[] = [
  { value: 'hide', label: '완전히 숨기기' },
  { value: 'blur', label: '흐리게' },
  { value: 'placeholder', label: '문구로 바꾸기' },
];

const DURATION_PRESETS = [DAY_MS, 7 * DAY_MS, 30 * DAY_MS];

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
            ? `오래전에 차단한 ${syncWarning.unsynced}명은 다른 PC로 동기화되지 않아요.`
            : `동기화 공간의 ${syncWarning.percent}%를 쓰고 있어요.`}
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
        <p className="muted">기간을 바꿔도 이미 걸어 둔 임시 차단은 그대로예요.</p>
      </section>

      <div className="switches">
        <Switch
          label="답글도 함께 가리기"
          description="흐리게 하거나 문구로 바꿀 때 답글까지 가려요. 완전히 숨기기는 항상 답글까지 숨겨요."
          checked={settings.coverReplies}
          onChange={(coverReplies) => update({ coverReplies })}
        />
        <Switch
          label="디버그 패널"
          description="유튜브 화면 오른쪽에 확장기능이 읽은 댓글 목록을 띄워요."
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
      <Segmented label={`${props.kind} 표시 방법`} options={MODES} value={props.value} onChange={props.onChange} />
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
      {mode === 'hide' && <span className="muted">이 자리에 아무것도 남지 않아요</span>}
      {mode === 'blur' && (
        <span className="blurred">
          <span className="mono">@작성자</span> 흐리게 가린 댓글은 이렇게 보여요
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

/** 댓글 메뉴의 "임시 차단"이 쓰는 기간. 고정 항목 셋 또는 직접 입력(시간이나 일). */
function DurationField(props: { value: number; onChange: (ms: number) => void }) {
  // "직접 입력"을 골랐는지, 어떤 단위로 적었는지는 저장하지 않는다. 저장하는 건 ms 하나다.
  // 그래서 값이 고정 항목과 같으면 다음에 열 때는 그 항목으로 보인다.
  const [custom, setCustom] = useState(!DURATION_PRESETS.includes(props.value));
  const [unit, setUnit] = useState(props.value % DAY_MS === 0 ? DAY_MS : HOUR_MS);
  const [amount, setAmount] = useState(String(props.value / unit));

  const commit = (text: string, unitMs: number) => {
    const n = Number(text);
    if (Number.isInteger(n) && n > 0) props.onChange(n * unitMs);
  };

  const options: SegmentedOption<number | 'custom'>[] = [
    ...DURATION_PRESETS.map((ms) => ({ value: ms, label: formatDuration(ms) })),
    // 고정폭 글꼴에서는 띄어쓰기가 넓게 벌어져서 "직접 입력"이 아니라 "직접"으로 쓴다
    { value: 'custom', label: '직접' },
  ];

  return (
    <div className="field">
      {/* 직접 입력칸은 "기간"과 같은 줄에 둔다. 줄을 하나 더 쓰면 팝업이 600px을 넘는다 */}
      <div className="field-head">
        <span className="field-label">기간</span>
        {custom && (
          <div className="custom-duration">
            <input
              type="number"
              className="mono"
              min={1}
              max={9999}
              step={1}
              value={amount}
              aria-label="기간"
              onChange={(e) => {
                setAmount(e.target.value);
                commit(e.target.value, unit);
              }}
            />
            <select
              value={unit}
              aria-label="단위"
              onChange={(e) => {
                const next = Number(e.target.value);
                setUnit(next);
                commit(amount, next);
              }}
            >
              <option value={HOUR_MS}>시간</option>
              <option value={DAY_MS}>일</option>
            </select>
          </div>
        )}
      </div>
      <Segmented
        label="임시 차단 기간"
        className="mono"
        options={options}
        value={custom ? 'custom' : props.value}
        onChange={(next) => {
          if (next === 'custom') {
            // 고정 항목을 오가다 들어오면 입력칸이 예전 값을 들고 있다. 지금 설정값에서 다시 채운다.
            const current = props.value % DAY_MS === 0 ? DAY_MS : HOUR_MS;
            setUnit(current);
            setAmount(String(props.value / current));
            setCustom(true);
          } else {
            setCustom(false);
            props.onChange(next);
          }
        }}
      />
    </div>
  );
}

/** 켜고 끄는 설정 한 줄. 제목과 설명이 왼쪽, 스위치가 오른쪽이다. */
function Switch(props: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId();
  return (
    <label className="switch">
      <span className="switch-text">
        <span id={`${id}-label`} className="switch-label">
          {props.label}
        </span>
        <span id={`${id}-desc`} className="muted">
          {props.description}
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={props.checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-desc`}
        onChange={(e) => props.onChange(e.target.checked)}
      />
    </label>
  );
}
