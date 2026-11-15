import { useState } from 'react';
import Segmented, { type SegmentedOption } from '@/components/Segmented';
import { useI18n } from '@/hooks/useI18n';
import { DAY_MS, HOUR_MS, formatDuration } from '@/utils/duration';

const DURATION_PRESETS = [DAY_MS, 7 * DAY_MS, 30 * DAY_MS];

/** 직접 입력의 가장 큰 수. 입력칸의 max는 브라우저가 알려 주기만 하고 막지 않아서 저장할 때도 본다. */
const MAX_AMOUNT = 9999;

/**
 * 댓글 메뉴의 "임시 차단"이 쓰는 기간. 고정 항목 셋 또는 직접 입력(시간이나 일). 팝업과 첫 사용 안내가 쓴다.
 * 모양은 assets/base.css의 .field.
 */
export default function DurationField(props: { value: number; onChange: (ms: number) => void }) {
  const { t } = useI18n();
  // "직접 입력"을 골랐는지, 어떤 단위로 적었는지는 저장하지 않는다. 저장하는 건 ms 하나다.
  // 그래서 값이 고정 항목과 같으면 다음에 열 때는 그 항목으로 보인다.
  const [custom, setCustom] = useState(!DURATION_PRESETS.includes(props.value));
  const [unit, setUnit] = useState(props.value % DAY_MS === 0 ? DAY_MS : HOUR_MS);
  const [amount, setAmount] = useState(String(props.value / unit));

  const commit = (text: string, unitMs: number) => {
    const n = Number(text);
    if (Number.isInteger(n) && n > 0 && n <= MAX_AMOUNT) props.onChange(n * unitMs);
  };

  const options: SegmentedOption<number | 'custom'>[] = [
    ...DURATION_PRESETS.map((ms) => ({ value: ms, label: formatDuration(ms, t.common) })),
    // 고정폭 글꼴에서는 띄어쓰기가 넓게 벌어져서 짧게 쓴다("직접 입력"이 아니라 "직접")
    { value: 'custom', label: t.duration.custom },
  ];

  return (
    <div className="field">
      {/* 직접 입력칸은 "기간"과 같은 줄에 둔다. 줄을 하나 더 쓰면 팝업이 600px을 넘는다 */}
      <div className="field-head">
        <span className="field-label">{t.duration.label}</span>
        {custom && (
          <div className="custom-duration">
            <input
              type="number"
              className="mono"
              min={1}
              max={MAX_AMOUNT}
              step={1}
              value={amount}
              aria-label={t.duration.amount}
              onChange={(e) => {
                setAmount(e.target.value);
                commit(e.target.value, unit);
              }}
            />
            <select
              value={unit}
              aria-label={t.duration.unit}
              onChange={(e) => {
                const next = Number(e.target.value);
                setUnit(next);
                commit(amount, next);
              }}
            >
              <option value={HOUR_MS}>{t.duration.hours}</option>
              <option value={DAY_MS}>{t.duration.days}</option>
            </select>
          </div>
        )}
      </div>
      <Segmented
        label={t.duration.group}
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
