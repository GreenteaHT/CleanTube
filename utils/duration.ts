export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/** "7일", "12시간". 하루 단위로 떨어지면 일로, 아니면 시간으로 적는다. */
export function formatDuration(ms: number): string {
  return ms % DAY_MS === 0 ? `${ms / DAY_MS}일` : `${Math.round(ms / HOUR_MS)}시간`;
}
