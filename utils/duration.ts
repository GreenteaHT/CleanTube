export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/** 기간을 언어마다 어떻게 적는지. locales/의 common이 이 모양이다. */
export interface DurationUnits {
  days(n: number): string;
  hours(n: number): string;
}

/** "7일", "12 hours". 하루 단위로 떨어지면 일로, 아니면 시간으로 적는다. */
export function formatDuration(ms: number, units: DurationUnits): string {
  return ms % DAY_MS === 0 ? units.days(ms / DAY_MS) : units.hours(Math.round(ms / HOUR_MS));
}
