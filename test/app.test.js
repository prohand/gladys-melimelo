// -----------------------------------------------------------------------------
// The integration end to end: the real handlers (src/app.js) against the SDK's
// fake Gladys and the in-memory Melimelo API.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { registerHandlers } from '../src/app.js';
import { FEATURES, householdIds } from '../src/devices/household.js';
import { SCENE_TRIGGERS } from '../src/capabilities/triggers.js';
import { HOUSEHOLD_WIDGET, WIDGET_ACTIONS, WIDGET_LISTS } from '../src/capabilities/widget.js';
import { NOT_CONFIGURED } from '../src/messages.js';
import { API_URL, TOKEN, createFakeMelimelo } from './helpers/fakeMelimelo.js';

const CONFIG = { api_url: API_URL, api_token: TOKEN, timezone: 'Europe/Paris' };

async function start(t, { config = CONFIG, data, now = '2026-11-11T18:30:00Z' } = {}) {
  const melimelo = createFakeMelimelo(data);
  const gladys = createFakeGladys({ config });
  const clock = { now: new Date(now) };
  const app = registerHandlers(gladys, { fetch: melimelo.fetch, now: () => clock.now });
  await gladys.connect();
  t.after(() => gladys.disconnect());
  return { gladys, melimelo, app, clock };
}

const HOUSEHOLD_DATA = {
  tasks: [
    { id: 't1', title: 'Sortir le chien', due_date: '2026-11-11', assignee: 'Léa' },
    { id: 't2', title: 'Changer les draps', due_date: '2026-11-01' },
    { id: 't3', title: 'Arroser les plantes' },
  ],
  shopping: [{ id: 's1', name: 'Lait', quantity: '2 L' }],
  garbage: [{ date: '2026-11-12', type: 'Recyclage', label: 'Bac jaune' }],
  birthdays: [{ name: 'Mamie', date: '1946-11-20' }],
  events: [{ id: 'e1', title: 'Réunion parents', start: '2026-11-11T18:40:00Z' }],
};

test('the first sync publishes the household device, its figures and the connection', async (t) => {
  const { gladys } = await start(t, { data: HOUSEHOLD_DATA });
  const [device] = gladys.fake.discoveredDevices;
  assert.equal(device.name, 'Melimelo – Les Martin');
  assert.equal(device.should_poll, false);

  const ids = householdIds(gladys, { id: 'hh-1' });
  assert.equal(device.external_id, ids.device);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURES.TASKS_OPEN)), 3);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURES.TASKS_OVERDUE)), 1);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURES.SHOPPING_ITEMS)), 1);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURES.EVENTS_TODAY)), 1);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURES.NEXT_COLLECTION_DAYS)), 1);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURES.NEXT_COLLECTION)), 'Bac jaune');
  assert.equal(gladys.fake.lastState(ids.feature(FEATURES.NEXT_BIRTHDAY_DAYS)), 9);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURES.NEXT_BIRTHDAY)), 'Mamie (80)');
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true });
});

test('the date-based triggers fire once, even after a second sync', async (t) => {
  const { gladys, app } = await start(t, { data: HOUSEHOLD_DATA });
  const keys = () => gladys.fake.sceneEvents.map((event) => event.key).sort();
  const expected = [
    SCENE_TRIGGERS.EVENT_STARTING_SOON,
    SCENE_TRIGGERS.GARBAGE_COLLECTION_TOMORROW,
    SCENE_TRIGGERS.TASK_DUE,
  ];
  assert.deepEqual(keys(), expected);
  await app.sync.sync();
  assert.deepEqual(keys(), expected);
});

test('a shopping item added in Melimelo fires, one added by Gladys does not', async (t) => {
  const { gladys, melimelo, app } = await start(t);
  const ack = await gladys.fake.sceneAction('add_shopping_item', { item: 'Piles', quantity: '4' });
  assert.deepEqual(ack, { success: true, data: { outputs: { added: true } } });

  melimelo.data.shopping.push({ id: 'x1', name: 'Café', quantity: null, added_by: 'Paul' });
  await app.sync.sync();
  const added = gladys.fake.sceneEvents.filter(
    (event) => event.key === SCENE_TRIGGERS.SHOPPING_ITEM_ADDED,
  );
  assert.deepEqual(added, [
    {
      key: SCENE_TRIGGERS.SHOPPING_ITEM_ADDED,
      data: { item: 'Café', quantity: null, added_by: 'Paul' },
    },
  ]);
});

test('the task scene actions create, complete, and say when nothing matched', async (t) => {
  const { gladys, melimelo } = await start(t, {
    data: { tasks: [{ id: 't1', title: 'Étendre le linge' }] },
  });

  const created = await gladys.fake.sceneAction('create_task', {
    title: 'Acheter du pain',
    due_date: '2026-11-12',
  });
  assert.equal(created.success, true);
  assert.match(created.data.outputs.task_id, /^t-/);

  assert.deepEqual(await gladys.fake.sceneAction('complete_task', { title: 'etendre LE linge' }), {
    success: true,
    data: { outputs: { completed: true } },
  });
  assert.ok(!melimelo.data.tasks.some((task) => task.id === 't1'));
  assert.deepEqual(await gladys.fake.sceneAction('complete_task', { title: 'Inconnue' }), {
    success: true,
    data: { outputs: { completed: false } },
  });

  const refused = await gladys.fake.sceneAction('create_task', { title: 'X', due_date: 'demain' });
  assert.equal(refused.success, false);

  const synced = await gladys.fake.sceneAction('sync_now');
  assert.deepEqual(synced.data.outputs, { tasks_open: 1, shopping_items: 0 });
});

test('without a URL and a token, the integration says what is missing', async (t) => {
  const { gladys, melimelo } = await start(t, { config: {} });
  assert.deepEqual(gladys.fake.connectionStatus, { connected: false, message: NOT_CONFIGURED });
  assert.equal(melimelo.requests.length, 0);
  assert.deepEqual((await gladys.fake.action('test_connection')).data.message, NOT_CONFIGURED);
  const ack = await gladys.fake.sceneAction('add_shopping_item', { item: 'Lait' });
  assert.equal(ack.success, false);
});

test('a refused token shows in the connection status, then a new one is used', async (t) => {
  const { gladys } = await start(t, { config: { ...CONFIG, api_token: 'old' } });
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /jeton/);

  await gladys.fake.configUpdated(CONFIG);
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true });
  assert.equal(gladys.fake.discoveredDevices.length, 1);
});

test('the connection test reports the household', async (t) => {
  const { gladys } = await start(t, { data: HOUSEHOLD_DATA });
  const {
    data: { message: data },
  } = await gladys.fake.action('test_connection');
  assert.match(data.fr, /Les Martin.*3 tâche\(s\).*1 article\(s\)/);
  assert.deepEqual(Object.keys(data).sort(), ['de', 'en', 'es', 'fr']);
});

test('the widget renders exactly as sent, for every list and state', async (t) => {
  const { gladys } = await start(t, { data: HOUSEHOLD_DATA });
  for (const list of WIDGET_LISTS) {
    for (const language of ['en', 'fr', 'de', 'es']) {
      const { success, data } = await gladys.fake.widgetGet(HOUSEHOLD_WIDGET, {
        settings: { list },
        language,
      });
      assert.equal(success, true);
      assert.deepEqual(validateWidgetContent(data.content), [], `${list}/${language}`);
    }
  }
  const unconfigured = await start(t, { config: {} });
  const { data } = await unconfigured.gladys.fake.widgetGet(HOUSEHOLD_WIDGET);
  assert.deepEqual(validateWidgetContent(data.content), []);
  assert.deepEqual(data.content.components[0].text, NOT_CONFIGURED);
});

test('the widget form adds to the shopping list, and a tap without values is refused', async (t) => {
  const { gladys, melimelo } = await start(t);
  const ack = await gladys.fake.widgetAction(
    HOUSEHOLD_WIDGET,
    WIDGET_ACTIONS.ADD_SHOPPING_ITEM,
    {},
    {
      values: { item: 'Beurre', quantity: '' },
    },
  );
  assert.equal(ack.success, true);
  assert.equal(ack.data.message.fr, '« Beurre » ajouté à la liste de courses.');
  assert.equal(melimelo.data.shopping.at(-1).name, 'Beurre');

  const old = await gladys.fake.widgetAction(HOUSEHOLD_WIDGET, WIDGET_ACTIONS.ADD_SHOPPING_ITEM);
  assert.equal(old.success, false);

  const synced = await gladys.fake.widgetAction(HOUSEHOLD_WIDGET, WIDGET_ACTIONS.SYNC_NOW);
  assert.equal(synced.data.message.en, 'Synchronized with Melimelo.');
  assert.ok(gladys.fake.widgetRefreshes.includes(HOUSEHOLD_WIDGET));
});

test('the token never reaches Gladys: not in a state, an event or a status', async (t) => {
  const { gladys } = await start(t, { data: HOUSEHOLD_DATA, config: { ...CONFIG } });
  await gladys.fake.action('test_connection');
  const sent = JSON.stringify(
    gladys.fake.requests
      .filter((request) => request.path !== '/config')
      .map((request) => request.body),
  );
  assert.ok(!sent.includes(TOKEN));
});
