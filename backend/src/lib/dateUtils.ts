// Use UTC midnight for "today" so the daily-rollover boundary is stable
// regardless of server timezone or DST shifts. The previous local-tz approach
// could produce two different `today` values for the same wall-clock day,
// creating duplicate rows under the (userId, date) unique constraint.
export const todayUtcStart = (now: Date = new Date()): Date => {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );
  return d;
};

export const utcDayStart = (date: Date): Date =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
  );
