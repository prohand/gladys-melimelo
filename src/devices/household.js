// -----------------------------------------------------------------------------
// Device type: the HOUSEHOLD.
//
// Melimelo has no hardware: what Gladys gets is one device per household, whose
// read-only features are the figures a scene or a dashboard wants to follow —
// how many tasks are open or late, how long the shopping list is, when the bins
// go out next, whose birthday is coming. They are states (a value that
// changes), so scenes can use them in conditions ("if there are late tasks")
// and Gladys keeps their history. What HAPPENS (a task is due, an item was
// added) goes through the scene triggers instead, see src/capabilities/triggers.js.
//
// There is no `poll_frequency`: the integration synchronizes on its own timer
// (src/melimelo/sync.js), so the triggers fire even before the user creates
// the device, and publishes the states that changed.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';

export const DEVICE_TYPE = 'household';

/** Feature keys. Stored by Gladys in the external ids: never renamed. */
export const FEATURES = {
  TASKS_OPEN: 'tasks-open',
  TASKS_OVERDUE: 'tasks-overdue',
  SHOPPING_ITEMS: 'shopping-items',
  EVENTS_TODAY: 'events-today',
  NEXT_COLLECTION_DAYS: 'next-collection-days',
  NEXT_COLLECTION: 'next-collection',
  NEXT_BIRTHDAY_DAYS: 'next-birthday-days',
  NEXT_BIRTHDAY: 'next-birthday',
};

// A count shown as a plain number: Gladys has no "count of things" category.
const counter = (name, key) => ({
  name,
  key,
  category: DEVICE_FEATURE_CATEGORIES.UNKNOWN,
  type: DEVICE_FEATURE_TYPES.UNKNOWN.UNKNOWN,
  min: 0,
  max: 10000,
});

const daysUntil = (name, key) => ({
  name,
  key,
  category: DEVICE_FEATURE_CATEGORIES.DURATION,
  type: DEVICE_FEATURE_TYPES.DURATION.INTEGER,
  unit: DEVICE_FEATURE_UNITS.DAYS,
  min: 0,
  max: 366,
});

const label = (name, key) => ({
  name,
  key,
  category: DEVICE_FEATURE_CATEGORIES.TEXT,
  type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
  min: 0,
  max: 0,
  keep_history: false,
});

const FEATURE_LIST = [
  counter('Open tasks', FEATURES.TASKS_OPEN),
  counter('Overdue tasks', FEATURES.TASKS_OVERDUE),
  counter('Shopping list items', FEATURES.SHOPPING_ITEMS),
  counter("Today's events", FEATURES.EVENTS_TODAY),
  daysUntil('Days until the next bin collection', FEATURES.NEXT_COLLECTION_DAYS),
  label('Next bin collection', FEATURES.NEXT_COLLECTION),
  daysUntil('Days until the next birthday', FEATURES.NEXT_BIRTHDAY_DAYS),
  label('Next birthday', FEATURES.NEXT_BIRTHDAY),
];

/** The external ids of a household device. */
export function householdIds(gladys, household) {
  return gladys.externalIds(DEVICE_TYPE, household.id);
}

/** The discovery payload of a household. */
export function buildHouseholdDevice(gladys, household) {
  const ids = householdIds(gladys, household);
  return {
    name: `Melimelo – ${household.name}`,
    external_id: ids.device,
    // Synchronized by the integration's own timer, never polled by Gladys.
    should_poll: false,
    features: FEATURE_LIST.map(({ key, ...feature }) => ({
      read_only: true,
      has_feedback: false,
      keep_history: true,
      ...feature,
      external_id: ids.feature(key),
    })),
  };
}

/**
 * The states of a household, from the summary of a snapshot. A value Melimelo
 * does not know (no collection planned) is left out rather than published as 0:
 * "0 days" would read as "today".
 */
export function buildHouseholdStates(gladys, household, summary) {
  const ids = householdIds(gladys, household);
  const state = (key, value) => ({ device_feature_external_id: ids.feature(key), state: value });
  const textState = (key, value) => ({ device_feature_external_id: ids.feature(key), text: value });
  const states = [
    state(FEATURES.TASKS_OPEN, summary.tasksOpen),
    state(FEATURES.TASKS_OVERDUE, summary.tasksOverdue),
    state(FEATURES.SHOPPING_ITEMS, summary.shoppingItems),
    state(FEATURES.EVENTS_TODAY, summary.eventsToday),
  ];
  if (summary.nextCollection) {
    states.push(
      state(FEATURES.NEXT_COLLECTION_DAYS, summary.nextCollection.days),
      textState(
        FEATURES.NEXT_COLLECTION,
        summary.nextCollection.label ?? summary.nextCollection.type,
      ),
    );
  }
  if (summary.nextBirthday) {
    const { name, age, days } = summary.nextBirthday;
    states.push(
      state(FEATURES.NEXT_BIRTHDAY_DAYS, days),
      textState(FEATURES.NEXT_BIRTHDAY, age ? `${name} (${age})` : name),
    );
  }
  return states;
}
