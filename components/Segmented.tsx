export interface SegmentedOption<T> {
  value: T;
  label: string;
}

interface Props<T> {
  /** 묶음 이름. 화면에는 없고 스크린 리더가 읽는다. */
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** 여러 칸 중 하나를 고르는 버튼 묶음. 모양은 assets/base.css의 .segmented. */
export default function Segmented<T extends string | number>({ label, options, value, onChange, className }: Props<T>) {
  return (
    <div role="group" aria-label={label} className={className ? `segmented ${className}` : 'segmented'}>
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
