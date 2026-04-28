import { todayUtcStart, utcDayStart } from './dateUtils';

describe('dateUtils', () => {
  it('todayUtcStart returns midnight UTC for arbitrary inputs', () => {
    const d = todayUtcStart(new Date('2026-04-28T13:45:00Z'));
    expect(d.toISOString()).toBe('2026-04-28T00:00:00.000Z');
  });

  it('todayUtcStart is identical regardless of local-time hour', () => {
    // Two times on the same UTC day should produce the same start.
    const a = todayUtcStart(new Date('2026-04-28T00:00:00Z'));
    const b = todayUtcStart(new Date('2026-04-28T23:59:59Z'));
    expect(a.getTime()).toBe(b.getTime());
  });

  it('utcDayStart works for an ISO date', () => {
    const d = utcDayStart(new Date('2026-04-28T13:45:00Z'));
    expect(d.toISOString()).toBe('2026-04-28T00:00:00.000Z');
  });
});
