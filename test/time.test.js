import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  daysBetween,
  isDay,
  localDate,
  localHour,
  localTime,
  toDay,
} from '../src/time.js';

test('the calendar date follows the household time zone, not UTC', () => {
  const lateEvening = new Date('2026-11-11T23:30:00Z');
  assert.equal(localDate(lateEvening, 'UTC'), '2026-11-11');
  assert.equal(localDate(lateEvening, 'Europe/Paris'), '2026-11-12');
  assert.equal(localHour(lateEvening, 'Europe/Paris'), 0);
  assert.equal(localTime(lateEvening, 'Europe/Paris'), '00:30');
});

test('day arithmetic crosses months, years and DST', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
  assert.equal(daysBetween('2026-11-12', '2026-11-10'), -2);
});

test('dates are recognized in both API shapes', () => {
  assert.equal(isDay('2026-02-30'), false);
  assert.equal(isDay('2026-02-28'), true);
  assert.equal(toDay('2026-11-12', 'Europe/Paris'), '2026-11-12');
  assert.equal(toDay('2026-11-11T23:30:00Z', 'Europe/Paris'), '2026-11-12');
  assert.equal(toDay('garbage', 'Europe/Paris'), null);
  assert.equal(toDay(null, 'Europe/Paris'), null);
});
