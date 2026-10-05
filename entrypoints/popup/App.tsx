import { useState } from 'react';
import BlockList from '@/components/BlockList';
import { useBlocked } from '@/hooks/useBlocked';
import { useSettings } from '@/hooks/useSettings';
import { DAY_MS, HOUR_MS, formatDuration } from '@/utils/duration';
import './App.css';

const DURATION_PRESETS = [DAY_MS, 7 * DAY_MS, 30 * DAY_MS];

/** 툴바 아이콘을 눌렀을 때 뜨는 팝업. 차단 목록, 임시 차단 설정, 디버그 패널 토글. */
export default function App() {
  const { settings, update } = useSettings();
  const { blocked, add, remove } = useBlocked();

  if (!settings || !blocked) return <div className="popup muted">불러오는 중…</div>;

  return (
    <div className="popup">
      <h1>CleanTube</h1>

      <BlockList entries={blocked} onAdd={add} onRemove={remove} />
      <p className="muted">
        유튜브 댓글에 마우스를 올리면 나오는 버튼으로도 차단할 수 있어요. 임시 차단은 거기서만 돼요.
      </p>

      <section className="kind">
        <h2>임시 차단</h2>
        <DurationField
          value={settings.temporaryDurationMs}
          onChange={(temporaryDurationMs) => update({ temporaryDurationMs })}
        />
        <p className="muted">기간을 바꿔도 이미 걸어 둔 임시 차단은 그대로예요.</p>
      </section>

      <label className="toggle">
        <input
          type="checkbox"
          checked={settings.debugPanel}
          onChange={(e) => update({ debugPanel: e.target.checked })}
        />
        디버그 패널
      </label>
      <p className="muted">유튜브 화면 오른쪽에 확장기능이 읽은 댓글 목록을 띄워요.</p>
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

  return (
    <>
      <label className="field">
        기간
        <select
          value={custom ? 'custom' : props.value}
          onChange={(e) => {
            if (e.target.value === 'custom') {
              // 고정 항목을 오가다 들어오면 입력칸이 예전 값을 들고 있다. 지금 설정값에서 다시 채운다.
              const current = props.value % DAY_MS === 0 ? DAY_MS : HOUR_MS;
              setUnit(current);
              setAmount(String(props.value / current));
              setCustom(true);
            } else {
              setCustom(false);
              props.onChange(Number(e.target.value));
            }
          }}
        >
          {DURATION_PRESETS.map((ms) => (
            <option key={ms} value={ms}>
              {formatDuration(ms)}
            </option>
          ))}
          <option value="custom">직접 입력</option>
        </select>
      </label>

      {custom && (
        <div className="field custom-duration">
          <input
            type="number"
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
    </>
  );
}
