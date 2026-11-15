import { describe, expect, it } from 'vitest';
import { en } from '../locales/en';
import { ko } from '../locales/ko';
import { DAY_MS, HOUR_MS, formatDuration } from '../utils/duration';

describe('formatDuration', () => {
  it('하루 단위로 떨어지면 일', () => {
    expect(formatDuration(DAY_MS, ko.common)).toBe('1일');
    expect(formatDuration(7 * DAY_MS, ko.common)).toBe('7일');
    expect(formatDuration(24 * HOUR_MS, ko.common)).toBe('1일');
  });

  it('아니면 시간', () => {
    expect(formatDuration(HOUR_MS, ko.common)).toBe('1시간');
    expect(formatDuration(36 * HOUR_MS, ko.common)).toBe('36시간');
  });

  it('영어는 하나일 때 단수', () => {
    expect(formatDuration(DAY_MS, en.common)).toBe('1 day');
    expect(formatDuration(30 * DAY_MS, en.common)).toBe('30 days');
    expect(formatDuration(HOUR_MS, en.common)).toBe('1 hour');
    expect(formatDuration(12 * HOUR_MS, en.common)).toBe('12 hours');
  });
});
