import type { SegmentedOption } from '@/components/Segmented';
import type { DisplayMode } from '@/utils/settings';

/** 표시 방법의 이름. 세 칸 버튼에 나란히 들어가야 해서 짧게 쓴다. "차단된 댓글" 글자는 미리보기와 예시에 그대로 보인다. */
export const DISPLAY_MODE_OPTIONS: SegmentedOption<DisplayMode>[] = [
  { value: 'hide', label: '완전히 숨기기' },
  { value: 'blur', label: '흐리게' },
  { value: 'placeholder', label: '문구로 바꾸기' },
];

export function displayModeLabel(mode: DisplayMode): string {
  return DISPLAY_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode;
}
