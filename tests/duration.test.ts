import { describe, expect, it } from 'vitest';
import { DAY_MS, HOUR_MS, formatDuration } from '../utils/duration';

describe('formatDuration', () => {
  it('하루 단위로 떨어지면 일', () => {
    expect(formatDuration(DAY_MS)).toBe('1일');
    expect(formatDuration(7 * DAY_MS)).toBe('7일');
    expect(formatDuration(24 * HOUR_MS)).toBe('1일');
  });

  it('아니면 시간', () => {
    expect(formatDuration(HOUR_MS)).toBe('1시간');
    expect(formatDuration(36 * HOUR_MS)).toBe('36시간');
  });
});
