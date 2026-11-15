import { useEffect, useRef, useState } from 'react';
import Segmented, { type SegmentedOption } from '@/components/Segmented';
import { useI18n } from '@/hooks/useI18n';
import { DAY_MS, HOUR_MS, formatDuration } from '@/utils/duration';

const DURATION_PRESETS = [DAY_MS, 7 * DAY_MS, 30 * DAY_MS];

/** 직접 입력의 가장 큰 수. 입력칸의 max는 스피너만 멈추고 타자는 막지 않아서 자릿수로 막는다. */
const MAX_AMOUNT = 9999;

/**
 * 직접 입력칸에 들어갈 수 있는 글. 숫자만, MAX_AMOUNT의 자릿수까지.
 * 소수나 0 같은 값을 받아 두고 저장만 안 하면 입력칸의 수와 실제로 쓰이는 기간이 어긋나서, 들어오지 않게 막는다.
 */
const AMOUNT_TEXT = new RegExp(`^\\d{0,${String(MAX_AMOUNT).length}}$`);

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
  const amountRef = useRef<HTMLInputElement>(null);
  // "직접"을 눌러 입력칸이 막 나타났는지. 입력칸은 줄 앞쪽("기간" 옆)에 생겨서, 포커스가 버튼에 그대로 있으면
  // 키보드로는 Tab으로 갈 수 없고 버튼 셋을 거슬러 올라가야 한다. 나타나면 입력칸으로 옮기고 숫자를 골라 둔다.
  const justOpened = useRef(false);

  useEffect(() => {
    if (!custom || !justOpened.current) return;
    justOpened.current = false;
    amountRef.current?.focus();
    amountRef.current?.select();
  }, [custom]);

  const commit = (text: string, unitMs: number) => {
    const n = Number(text);
    if (Number.isInteger(n) && n > 0 && n <= MAX_AMOUNT) props.onChange(n * unitMs);
  };

  // 입력칸을 지금 설정값으로 채운다. 하루로 떨어지면 일, 아니면 시간
  const fillFromValue = () => {
    const current = props.value % DAY_MS === 0 ? DAY_MS : HOUR_MS;
    setUnit(current);
    setAmount(String(props.value / current));
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
              ref={amountRef}
              type="number"
              className="mono"
              min={1}
              max={MAX_AMOUNT}
              step={1}
              value={amount}
              aria-label={t.duration.amount}
              // number 입력칸은 '.', 'e', '-', '+'를 받는다. 단축키와 화살표·지우기 같은 이름 있는 키는 그대로 둔다
              onKeyDown={(e) => {
                if (e.key.length === 1 && !/\d/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
              }}
              onPaste={(e) => {
                if (!/^\d+$/.test(e.clipboardData.getData('text'))) e.preventDefault();
              }}
              onChange={(e) => {
                // 받지 않으면 React가 입력칸을 앞의 값으로 되돌린다. 다섯째 자리는 여기서 막힌다
                if (!AMOUNT_TEXT.test(e.target.value)) return;
                setAmount(e.target.value);
                commit(e.target.value, unit);
              }}
              // 비우거나 0으로 두고 나가면 저장되지 않은 수가 남는다. 실제로 쓰이는 값으로 되돌린다
              onBlur={() => {
                if (!(Number(amount) > 0)) fillFromValue();
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
            fillFromValue();
            justOpened.current = true;
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
