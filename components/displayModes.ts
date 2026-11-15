import type { SegmentedOption } from '@/components/Segmented';
import { LOCALES, LOCALE_NAMES, type LanguageSetting, type Locale, type Messages } from '@/utils/i18n';
import type { DisplayMode } from '@/utils/settings';

/** 표시 방법의 이름. 세 칸 버튼에 나란히 들어가야 해서 짧게 쓴다. "차단된 댓글" 글자는 미리보기와 예시에 그대로 보인다. */
export function displayModeOptions(t: Messages): SegmentedOption<DisplayMode>[] {
  return [
    { value: 'hide', label: t.common.modes.hide },
    { value: 'blur', label: t.common.modes.blur },
    { value: 'placeholder', label: t.common.modes.placeholder },
  ];
}

export function displayModeLabel(mode: DisplayMode, t: Messages): string {
  return t.common.modes[mode];
}

/** 언어 고르는 곳(설정의 언어 탭, 첫 사용 안내)의 선택지. 맨 앞은 브라우저 언어 따름이고, 그때 쓰일 언어를 괄호에 적는다. */
export function languageOptions(t: Messages, browserLocale: Locale): SegmentedOption<LanguageSetting>[] {
  return [
    { value: 'auto', label: t.settings.languageAuto(LOCALE_NAMES[browserLocale]) },
    ...LOCALES.map((locale) => ({ value: locale, label: LOCALE_NAMES[locale] })),
  ];
}
