import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { browser } from '#imports';
import { messagesFor, resolveLocale, type LanguageSetting, type Locale, type Messages } from '@/utils/i18n';
import { loadSettings, watchSettings } from '@/utils/settings';

interface I18n {
  locale: Locale;
  t: Messages;
  /** 저장된 언어 설정. 'auto'면 브라우저 언어를 따르는 중. */
  setting: LanguageSetting;
  /** 'auto'일 때 쓰일 언어. 언어 고르는 곳에 "브라우저 언어 따름 (한국어)"처럼 적는다. */
  browserLocale: Locale;
}

const I18nContext = createContext<I18n | null>(null);

/**
 * 팝업, 차단 목록 페이지, 첫 사용 안내의 맨 바깥에 둔다. 언어 설정을 구독해서, 어느 창에서 바꾸든 모든 화면이 바로 그 언어로 다시 그려진다.
 * 설정을 읽기 전에는 아무것도 그리지 않는다. 브라우저 언어로 먼저 그렸다가 고른 언어로 바뀌며 깜박이지 않게.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [setting, setSetting] = useState<LanguageSetting | null>(null);
  const browserLocale = useMemo(() => resolveLocale('auto', browser.i18n.getUILanguage()), []);

  useEffect(() => {
    let alive = true;
    loadSettings().then((settings) => {
      if (alive) setSetting(settings.language);
    });
    const unwatch = watchSettings((settings) => setSetting(settings.language));
    return () => {
      alive = false;
      unwatch();
    };
  }, []);

  const value = useMemo<I18n | null>(() => {
    if (setting === null) return null;
    const locale = setting === 'auto' ? browserLocale : setting;
    return { locale, t: messagesFor(locale), setting, browserLocale };
  }, [setting, browserLocale]);

  useEffect(() => {
    // 화면 읽기 프로그램의 발음과 글꼴 고르기가 언어를 따르게
    if (value) document.documentElement.lang = value.locale;
  }, [value]);

  if (!value) return null;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error('I18nProvider 밖에서 useI18n을 불렀다');
  return value;
}
