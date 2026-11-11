import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig } from '../src/config.js';
import {
  detectSceneEvents,
  MAX_EVENTS_PER_SYNC,
  SCENE_TRIGGERS,
  TRIGGER_DATA_KEYS,
} from '../src/capabilities/triggers.js';
import { createFiredStore } from '../src/melimelo/firedStore.js';

const config = normalizeConfig({ garbage_reminder_hour: 19, event_notice_minutes: 15 });

function snapshot(overrides = {}) {
  return {
    household: { id: 'hh', name: 'Home' },
    tasks: [],
    shopping: [],
    garbage: [],
    birthdays: [],
    events: [],
    ...overrides,
  };
}

function detect({ previous = null, current, now, fired = createFiredStore(), ownItems }) {
  return detectSceneEvents({ previous, snapshot: current, config, now, fired, ownItems });
}

test('a task due today fires once, an older or later one never', () => {
  const now = new Date('2026-11-11T08:00:00Z');
  const fired = createFiredStore();
  const current = snapshot({
    tasks: [
      { id: 'a', title: 'Today', due: '2026-11-11', assignee: 'Léa' },
      { id: 'b', title: 'Late', due: '2026-11-01', assignee: null },
      { id: 'c', title: 'Later', due: '2026-11-20', assignee: null },
    ],
  });
  const events = detect({ current, now, fired });
  assert.deepEqual(events, [
    {
      key: SCENE_TRIGGERS.TASK_DUE,
      once: 'task_due:a:2026-11-11',
      data: { title: 'Today', assignee: 'Léa', due_date: '2026-11-11' },
    },
  ]);
  fired.add(events[0].once);
  assert.deepEqual(detect({ current, now, fired }), []);
});

test('the bins reminder waits for the reminder hour, the day before', () => {
  const current = snapshot({
    garbage: [
      { date: '2026-11-12', type: 'recycling', label: 'Bac jaune' },
      { date: '2026-11-13', type: 'glass', label: null },
    ],
  });
  // 18:00 in Paris: too early.
  assert.deepEqual(detect({ current, now: new Date('2026-11-11T17:00:00Z') }), []);
  // 19:00 in Paris.
  assert.deepEqual(detect({ current, now: new Date('2026-11-11T18:00:00Z') }), [
    {
      key: SCENE_TRIGGERS.GARBAGE_COLLECTION_TOMORROW,
      once: 'garbage_collection_tomorrow:2026-11-12:recycling',
      data: { type: 'recycling', label: 'Bac jaune', date: '2026-11-12' },
    },
  ]);
});

test('a birthday fires on its day', () => {
  const current = snapshot({ birthdays: [{ name: 'Mamie', date: '2026-11-11', age: 80 }] });
  const [event] = detect({ current, now: new Date('2026-11-11T06:00:00Z') });
  assert.equal(event.key, SCENE_TRIGGERS.BIRTHDAY_TODAY);
  assert.deepEqual(event.data, { name: 'Mamie', age: 80 });
});

test('only the shopping items added since the last sync fire, never Gladys own ones', () => {
  const now = new Date('2026-11-11T10:00:00Z');
  const before = snapshot({
    shopping: [{ id: '1', name: 'Lait', quantity: null, addedBy: 'Paul' }],
  });
  const after = snapshot({
    shopping: [
      { id: '1', name: 'Lait', quantity: null, addedBy: 'Paul' },
      { id: '2', name: 'Café', quantity: '1', addedBy: 'Léa' },
      { id: '3', name: 'Piles', quantity: null, addedBy: 'Gladys' },
    ],
  });
  // The first snapshot is the baseline.
  assert.deepEqual(detect({ current: after, now }), []);
  const ownItems = { has: (value) => value === '3' };
  assert.deepEqual(detect({ previous: before, current: after, now, ownItems }), [
    {
      key: SCENE_TRIGGERS.SHOPPING_ITEM_ADDED,
      data: { item: 'Café', quantity: '1', added_by: 'Léa' },
    },
  ]);
});

test('an event fires within the notice, all-day and past events never', () => {
  const now = new Date('2026-11-11T13:50:00Z');
  const current = snapshot({
    events: [
      {
        id: 'e1',
        title: 'Dentiste',
        start: '2026-11-11T14:00:00.000Z',
        allDay: false,
        location: 'Cabinet',
      },
      {
        id: 'e2',
        title: 'Plus tard',
        start: '2026-11-11T15:00:00.000Z',
        allDay: false,
        location: null,
      },
      { id: 'e3', title: 'Férié', start: '2026-11-11T13:55:00.000Z', allDay: true, location: null },
      {
        id: 'e4',
        title: 'Passé',
        start: '2026-11-11T13:00:00.000Z',
        allDay: false,
        location: null,
      },
    ],
  });
  assert.deepEqual(detect({ current, now }), [
    {
      key: SCENE_TRIGGERS.EVENT_STARTING_SOON,
      once: 'event_starting_soon:e1:2026-11-11T14:00:00.000Z',
      data: { title: 'Dentiste', start_time: '15:00', location: 'Cabinet', minutes: 10 },
    },
  ]);
});

test('every event carries exactly the data keys its manifest declares', () => {
  const now = new Date('2026-11-11T18:30:00Z');
  const current = snapshot({
    tasks: [{ id: 'a', title: 'T', due: '2026-11-11', assignee: null }],
    garbage: [{ date: '2026-11-12', type: 'glass', label: null }],
    birthdays: [{ name: 'B', date: '2026-11-11', age: null }],
    shopping: [{ id: 's', name: 'S', quantity: null, addedBy: null }],
    events: [
      { id: 'e', title: 'E', start: '2026-11-11T18:40:00.000Z', allDay: false, location: null },
    ],
  });
  const events = detect({ previous: snapshot(), current, now });
  assert.deepEqual(
    new Set(events.map((event) => event.key)),
    new Set(Object.values(SCENE_TRIGGERS)),
  );
  for (const event of events) {
    assert.deepEqual(Object.keys(event.data).sort(), [...TRIGGER_DATA_KEYS[event.key]].sort());
  }
});

test('one sync never sends more than its share of the 300 events a minute', () => {
  const tasks = Array.from({ length: 100 }, (_, i) => ({
    id: `t${i}`,
    title: `T${i}`,
    due: '2026-11-11',
    assignee: null,
  }));
  const events = detect({ current: snapshot({ tasks }), now: new Date('2026-11-11T08:00:00Z') });
  assert.equal(events.length, MAX_EVENTS_PER_SYNC);
});
