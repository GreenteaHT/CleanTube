import { useId } from 'react';

/** 켜고 끄는 설정 한 줄. 제목과 설명이 왼쪽, 스위치가 오른쪽이다. 줄 어디를 눌러도 바뀐다. 모양은 assets/base.css의 .switch. */
export default function Switch(props: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** 지금은 바꿀 수 없을 때. 자리는 그대로 두고 흐리게 보인다. */
  disabled?: boolean;
  /** 스위치만 보이고 제목과 설명은 화면 읽기 프로그램만 읽는다. 제목은 마우스를 올리면 나온다. 팝업 맨 위 줄처럼 자리가 좁을 때. */
  hideText?: boolean;
  /** 제목만 작게 보인다. 설명은 화면 읽기 프로그램이 읽고 마우스를 올리면 나온다. 이름표 줄 오른쪽처럼 한 줄에 넣을 때. */
  compact?: boolean;
}) {
  const id = useId();
  const title = props.hideText ? props.label : props.compact ? props.description : undefined;
  return (
    <label className={props.compact ? 'switch compact' : 'switch'} title={title}>
      <span className={props.hideText ? 'sr-only' : 'switch-text'}>
        <span id={`${id}-label`} className="switch-label">
          {props.label}
        </span>
        <span id={`${id}-desc`} className={props.compact ? 'sr-only' : 'muted'}>
          {props.description}
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={props.checked}
        disabled={props.disabled}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-desc`}
        onChange={(e) => props.onChange(e.target.checked)}
      />
    </label>
  );
}
