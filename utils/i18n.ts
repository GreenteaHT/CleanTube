import { en, type Messages } from '../locales/en';
import { ja } from '../locales/ja';
import { ko } from '../locales/ko';
import { zhCN } from '../locales/zh-CN';
import { zhTW } from '../locales/zh-TW';

/**
 * UI 언어. 브라우저의 chrome.i18n은 늘 브라우저 언어를 따라서 사용자가 고른 언어로 바꿀 수 없다.
 * 그래서 번역은 locales/의 파일로 들고 있고, 설정(language)과 브라우저 언어로 여기서 하나를 고른다.
 * 확장 이름과 스토어 설명만 public/_locales(chrome.i18n)에 있다. manifest가 그것만 읽을 수 있어서.
 * 이 파일은 브라우저 API를 쓰지 않는다. 브라우저 언어는 부르는 쪽이 읽어 넘긴다. 단위 테스트가 가능해야 해서 matcher.ts처럼 상대 경로로 import한다.
 */

export type { Messages };

/** 값은 BCP 47 태그라 Intl의 날짜 표기와 <html lang>에 그대로 쓴다. */
export type Locale = 'en' | 'ko' | 'ja' | 'zh-CN' | 'zh-TW';

/** 'auto'면 브라우저 언어를 따른다. */
export type LanguageSetting = 'auto' | Locale;

export const LOCALES: readonly Locale[] = ['en', 'ko', 'ja', 'zh-CN', 'zh-TW'];

/** 언어 이름은 그 언어로 적는다. 지금 화면 언어를 못 읽는 사람도 자기 언어를 찾을 수 있게. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  ko: '한국어',
  ja: '日本語',
  'zh-CN': '中文（简体）',
  'zh-TW': '中文（繁體）',
};

/** 저장소에서 읽은 값이 이 버전이 아는 언어 설정인지. 더 새 버전을 쓰는 다른 PC가 모르는 언어를 동기화로 보낼 수 있다. */
export function isLanguageSetting(value: unknown): value is LanguageSetting {
  return value === 'auto' || LOCALES.some((locale) => locale === value);
}

const MESSAGES: Record<Locale, Messages> = { en, ko, ja, 'zh-CN': zhCN, 'zh-TW': zhTW };

/** 번체를 쓰는 지역. 이 밖의 중국어(본토, 싱가포르, 지역 없는 zh)는 간체 */
const TRADITIONAL = /^zh[-_](tw|hk|mo|hant)\b/i;

/**
 * 설정과 브라우저 언어(예: 'ko', 'ko-KR', 'zh-TW')로 쓸 언어를 고른다.
 * 중국어는 대만·홍콩·마카오와 'zh-Hant'면 번체, 나머지는 간체. 그 밖의 언어는 영어.
 */
export function resolveLocale(setting: LanguageSetting, uiLanguage: string): Locale {
  if (setting !== 'auto') return setting;
  const primary = uiLanguage.toLowerCase().split(/[-_]/)[0];
  if (primary === 'ko') return 'ko';
  if (primary === 'ja') return 'ja';
  if (primary === 'zh') return TRADITIONAL.test(uiLanguage) ? 'zh-TW' : 'zh-CN';
  return 'en';
}

export function messagesFor(locale: Locale): Messages {
  return MESSAGES[locale];
}
