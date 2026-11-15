import { describe, expect, it } from 'vitest';
import { LOCALES, isLanguageSetting, messagesFor, resolveLocale } from '../utils/i18n';

describe('isLanguageSetting', () => {
  it('auto와 다섯 언어만 받는다. 더 새 버전이 동기화로 보낸 모르는 언어는 받지 않는다', () => {
    for (const setting of ['auto', ...LOCALES]) expect(isLanguageSetting(setting)).toBe(true);
    for (const setting of ['de', 'zh', 'KO', '', undefined, null, 1]) expect(isLanguageSetting(setting)).toBe(false);
  });
});

describe('resolveLocale', () => {
  it('언어를 골랐으면 브라우저 언어와 상관없이 그 언어', () => {
    expect(resolveLocale('ja', 'ko-KR')).toBe('ja');
    expect(resolveLocale('en', 'zh-CN')).toBe('en');
  });

  it('auto면 브라우저 언어의 앞부분으로 고른다', () => {
    expect(resolveLocale('auto', 'ko')).toBe('ko');
    expect(resolveLocale('auto', 'ko-KR')).toBe('ko');
    expect(resolveLocale('auto', 'ja-JP')).toBe('ja');
    expect(resolveLocale('auto', 'en-GB')).toBe('en');
  });

  it('중국어는 대만·홍콩·마카오와 Hant면 번체, 나머지는 간체', () => {
    expect(resolveLocale('auto', 'zh-TW')).toBe('zh-TW');
    expect(resolveLocale('auto', 'zh_TW')).toBe('zh-TW');
    expect(resolveLocale('auto', 'zh-HK')).toBe('zh-TW');
    expect(resolveLocale('auto', 'zh-MO')).toBe('zh-TW');
    expect(resolveLocale('auto', 'zh-Hant-HK')).toBe('zh-TW');
    expect(resolveLocale('auto', 'zh-CN')).toBe('zh-CN');
    expect(resolveLocale('auto', 'zh-SG')).toBe('zh-CN');
    expect(resolveLocale('auto', 'zh-Hans-CN')).toBe('zh-CN');
    expect(resolveLocale('auto', 'zh')).toBe('zh-CN');
  });

  it('번체를 고르면 브라우저 언어가 간체여도 번체', () => {
    expect(resolveLocale('zh-TW', 'zh-CN')).toBe('zh-TW');
  });

  it('없는 언어는 영어', () => {
    expect(resolveLocale('auto', 'de-DE')).toBe('en');
    expect(resolveLocale('auto', '')).toBe('en');
  });
});

describe('messagesFor', () => {
  it('모든 언어의 문구가 영어와 같은 키를 갖는다', () => {
    const keys = (value: unknown, prefix = ''): string[] =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? Object.entries(value).flatMap(([key, child]) => keys(child, `${prefix}${key}.`))
        : [prefix];
    const english = keys(messagesFor('en')).sort();
    for (const locale of LOCALES) expect(keys(messagesFor(locale)).sort(), locale).toEqual(english);
  });

  it('빈 문구가 없다', () => {
    const empty = (value: unknown): boolean =>
      typeof value === 'string'
        ? value.trim() === ''
        : value && typeof value === 'object'
          ? Object.values(value).some(empty)
          : false;
    for (const locale of LOCALES) expect(empty(messagesFor(locale)), locale).toBe(false);
  });
});
