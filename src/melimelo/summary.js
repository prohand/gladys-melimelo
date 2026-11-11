// -----------------------------------------------------------------------------
// The figures of a snapshot: what the device, the widget and the "Test the
// connection" report all show. Computed once, in one place, so the three never
// disagree on what "overdue" or "today" mean.
// -----------------------------------------------------------------------------

import { daysBetween, localDate } from '../time.js';

/**
 * @param {object} snapshot as returned by MelimeloClient.fetchSnapshot
 * @param {Date} now
 * @param {string} timeZone
 */
export function summarize(snapshot, now, timeZone) {
  const today = localDate(now, timeZone);
  const tasks = snapshot.tasks ?? [];
  const nextCollection = (snapshot.garbage ?? []).find((entry) => entry.date >= today) ?? null;
  const nextBirthday = (snapshot.birthdays ?? []).find((entry) => entry.date >= today) ?? null;
  return {
    today,
    tasksOpen: tasks.length,
    tasksOverdue: tasks.filter((task) => task.due && task.due < today).length,
    tasksToday: tasks.filter((task) => task.due === today).length,
    shoppingItems: (snapshot.shopping ?? []).length,
    eventsToday: (snapshot.events ?? []).filter(
      (event) => localDate(new Date(event.start), timeZone) === today,
    ).length,
    nextCollection: nextCollection && {
      ...nextCollection,
      days: daysBetween(today, nextCollection.date),
    },
    nextBirthday: nextBirthday && { ...nextBirthday, days: daysBetween(today, nextBirthday.date) },
  };
}
