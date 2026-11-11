// -----------------------------------------------------------------------------
// Scene triggers (Gladys 5.1+): what HAPPENS in the household.
//
// Melimelo pushes nothing to the integration, so the events are deduced from
// two successive snapshots and from the calendar: "a task is due today", "the
// bins go out tomorrow", "it is Léa's birthday", "an item was added to the
// shopping list", "an event starts in 15 minutes".
//
// Two rules keep them honest:
//   - ONE event per occurrence. A date-based trigger is remembered under a
//     key (`task_due:<id>:<date>`…) in the fired store, which survives a restart
//     (src/melimelo/firedStore.js): a container restarted at noon does not wish
//     the same birthday twice.
//   - NEVER an event caused by Gladys itself: an item a scene added to the
//     shopping list is not announced back as "an item was added" — a scene bound
//     to both would loop through the integration.
//
// Keys are forever: scenes store them, so a published key is never renamed.
// -----------------------------------------------------------------------------

import { addDays, localDate, localHour, localTime } from '../time.js';

export const SCENE_TRIGGERS = {
  TASK_DUE: 'task_due',
  GARBAGE_COLLECTION_TOMORROW: 'garbage_collection_tomorrow',
  BIRTHDAY_TODAY: 'birthday_today',
  SHOPPING_ITEM_ADDED: 'shopping_item_added',
  EVENT_STARTING_SOON: 'event_starting_soon',
};

/** The data keys each trigger sends: the manifest `fields` and `variables` (tested). */
export const TRIGGER_DATA_KEYS = {
  [SCENE_TRIGGERS.TASK_DUE]: ['title', 'assignee', 'due_date'],
  [SCENE_TRIGGERS.GARBAGE_COLLECTION_TOMORROW]: ['type', 'label', 'date'],
  [SCENE_TRIGGERS.BIRTHDAY_TODAY]: ['name', 'age'],
  [SCENE_TRIGGERS.SHOPPING_ITEM_ADDED]: ['item', 'quantity', 'added_by'],
  [SCENE_TRIGGERS.EVENT_STARTING_SOON]: ['title', 'start_time', 'location', 'minutes'],
};

/**
 * The core accepts 300 events a minute per integration. A first sync on a
 * household with a long history must not spend them all: past this many in one
 * sync, the rest waits for the next one (they are not remembered as fired).
 */
export const MAX_EVENTS_PER_SYNC = 30;

/**
 * The events to fire for a new snapshot.
 *
 * @param {object} state
 * @param {object|null} state.previous the previous snapshot (null on the first sync)
 * @param {object} state.snapshot the new snapshot
 * @param {object} state.config normalized configuration
 * @param {Date} state.now
 * @param {{ has(key: string): boolean }} state.fired the occurrences already announced
 * @param {{ has(name: string): boolean }} [state.ownItems] shopping items Gladys added itself
 * @returns {Array<{ key: string, once?: string, data: object }>} `once` is the
 *   key to remember the occurrence under, when it is date-based
 */
export function detectSceneEvents({ previous, snapshot, config, now, fired, ownItems }) {
  const timeZone = config.timezone;
  const today = localDate(now, timeZone);
  const tomorrow = addDays(today, 1);
  const events = [];
  const once = (key, onceKey, data) => {
    if (!fired.has(onceKey)) events.push({ key, once: onceKey, data });
  };

  for (const task of snapshot.tasks) {
    if (task.due === today) {
      once(SCENE_TRIGGERS.TASK_DUE, `${SCENE_TRIGGERS.TASK_DUE}:${task.id}:${task.due}`, {
        title: task.title,
        assignee: task.assignee,
        due_date: task.due,
      });
    }
  }

  if (localHour(now, timeZone) >= config.garbage_reminder_hour) {
    for (const collection of snapshot.garbage) {
      if (collection.date === tomorrow) {
        once(
          SCENE_TRIGGERS.GARBAGE_COLLECTION_TOMORROW,
          `${SCENE_TRIGGERS.GARBAGE_COLLECTION_TOMORROW}:${collection.date}:${collection.type}`,
          { type: collection.type, label: collection.label, date: collection.date },
        );
      }
    }
  }

  for (const birthday of snapshot.birthdays) {
    if (birthday.date === today) {
      once(
        SCENE_TRIGGERS.BIRTHDAY_TODAY,
        `${SCENE_TRIGGERS.BIRTHDAY_TODAY}:${birthday.name}:${birthday.date}`,
        { name: birthday.name, age: birthday.age },
      );
    }
  }

  // An item is "added" when it was not in the previous snapshot. The first
  // snapshot is the baseline: the whole list is not new.
  if (previous) {
    const known = new Set(previous.shopping.map((item) => item.id));
    for (const item of snapshot.shopping) {
      if (known.has(item.id)) continue;
      if (ownItems?.has(item.id) || ownItems?.has(item.name)) continue;
      events.push({
        key: SCENE_TRIGGERS.SHOPPING_ITEM_ADDED,
        data: { item: item.name, quantity: item.quantity, added_by: item.addedBy },
      });
    }
  }

  const horizon = now.getTime() + config.event_notice_minutes * 60 * 1000;
  for (const event of snapshot.events) {
    const start = new Date(event.start).getTime();
    if (event.allDay || start <= now.getTime() || start > horizon) continue;
    once(
      SCENE_TRIGGERS.EVENT_STARTING_SOON,
      `${SCENE_TRIGGERS.EVENT_STARTING_SOON}:${event.id}:${event.start}`,
      {
        title: event.title,
        start_time: localTime(new Date(event.start), timeZone),
        location: event.location,
        minutes: Math.max(1, Math.round((start - now.getTime()) / 60_000)),
      },
    );
  }

  return events.slice(0, MAX_EVENTS_PER_SYNC);
}
