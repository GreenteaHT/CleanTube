import type { CSSProperties } from 'react';

export interface SegmentedOption<T> {
  value: T;
  label: string;
}

interface Props<T> {
  /** 묶음 이름. 화면에는 없고 스크린 리더가 읽는다. */
  label: string;
  options: SegmentedOption<T>[];
  /** 고른 값. null이면 아무 칸도 고르지 않은 상태(첫 사용 안내의 처음). */
  value: T | null;
  onChange: (value: T) => void;
  className?: string;
  /**
   * 고른 칸 뒤에 색 덩어리를 깔고, 고른 칸이 바뀌면 그 덩어리가 미끄러져 옮겨 간다. 칸 너비가 같을 때만 쓴다.
   * 칸 너비가 글자마다 다른 정렬 버튼은 끄고 고른 칸만 칠한다.
   */
  sliding?: boolean;
}

/** 여러 칸 중 하나를 고르는 버튼 묶음. 모양은 assets/base.css의 .segmented. */
export default function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  className,
  sliding = true,
}: Props<T>) {
  const index = options.findIndex((option) => option.value === value);
  const classes = ['segmented', sliding && 'sliding', className].filter(Boolean).join(' ');
  const style = sliding ? ({ '--count': options.length, '--index': Math.max(index, 0) } as CSSProperties) : undefined;

  return (
    <div role="group" aria-label={label} className={classes} style={style}>
      {sliding && <span className={index < 0 ? 'segmented-thumb empty' : 'segmented-thumb'} aria-hidden="true" />}
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          // 이미 고른 칸을 다시 눌러도 저장소에 같은 값을 다시 쓰지 않게
          onClick={() => option.value !== value && onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
