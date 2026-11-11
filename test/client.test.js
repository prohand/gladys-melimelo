import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  asList,
  garbageType,
  MelimeloApiError,
  MelimeloClient,
  normalizeBirthday,
  normalizeEvent,
  normalizeTask,
} from '../src/melimelo/client.js';
import { API_URL, TOKEN, createFakeMelimelo } from './helpers/fakeMelimelo.js';

const NOW = new Date('2026-11-11T10:00:00Z');
const TZ = 'Europe/Paris';

function client(fake, token = TOKEN) {
  return new MelimeloClient({ apiUrl: API_URL, token, fetch: fake.fetch });
}

test('the snapshot reads every list, normalized and sorted', async () => {
  const fake = createFakeMelimelo({
    tasks: [
      {
        id: 't1',
        title: 'Vider le lave-vaisselle',
        due_date: '2026-11-11',
        assignee: { name: 'Léa' },
      },
      { id: 't2', name: 'Déjà fait', status: 'done' },
    ],
    shopping: [
      { id: 's1', name: 'Lait', quantity: '2 L', addedBy: 'Paul' },
      { id: 's2', name: 'Pain', checked: true },
    ],
    garbage: [
      { date: '2026-11-14', type: 'Verre' },
      { date: '2026-11-12', type: 'Recyclage', label: 'Bac jaune' },
      { date: '2026-11-01', type: 'Ordures' },
    ],
    birthdays: [{ name: 'Mamie', date: '1946-11-20' }],
    events: [{ id: 'e1', title: 'Dentiste', start: '2026-11-11T14:00:00Z', location: 'Cabinet' }],
  });
  const snapshot = await client(fake).fetchSnapshot({ now: NOW, timeZone: TZ });

  assert.deepEqual(snapshot.household, { id: 'hh-1', name: 'Les Martin' });
  assert.deepEqual(snapshot.tasks, [
    { id: 't1', title: 'Vider le lave-vaisselle', due: '2026-11-11', assignee: 'Léa', done: false },
  ]);
  assert.deepEqual(
    snapshot.shopping.map((item) => item.name),
    ['Lait'],
  );
  assert.equal(snapshot.shopping[0].addedBy, 'Paul');
  assert.deepEqual(
    snapshot.garbage.map((entry) => [entry.date, entry.type]),
    [
      ['2026-11-12', 'recycling'],
      ['2026-11-14', 'glass'],
    ],
  );
  assert.deepEqual(snapshot.birthdays, [{ name: 'Mamie', date: '2026-11-20', age: 80 }]);
  assert.equal(snapshot.events[0].title, 'Dentiste');
  assert.equal(snapshot.today, '2026-11-11');
});

test('the token travels in the Authorization header only', async () => {
  const fake = createFakeMelimelo();
  await client(fake).fetchSnapshot({ now: NOW, timeZone: TZ });
  for (const request of fake.requests) {
    assert.equal(request.headers.Authorization, `Bearer ${TOKEN}`);
    assert.ok(!JSON.stringify(request.query).includes(TOKEN));
  }
  const garbage = fake.requests.find((request) => request.path.endsWith('/garbage-collections'));
  assert.deepEqual(garbage.query, { from: '2026-11-11', to: '2026-11-25' });
});

test('API failures become typed errors without the token', async () => {
  const fake = createFakeMelimelo();
  await assert.rejects(client(fake, 'wrong').getHousehold(), (err) => {
    assert.ok(err instanceof MelimeloApiError);
    assert.equal(err.kind, 'unauthorized');
    assert.equal(err.status, 401);
    assert.ok(!err.message.includes('wrong'));
    return true;
  });
  for (const [status, kind] of [
    [404, 'not_found'],
    [429, 'rate_limited'],
    [503, 'server'],
    ['network', 'network'],
  ]) {
    fake.failWith(status);
    await assert.rejects(client(fake).getHousehold(), { kind });
  }
});

test('an answer that is not JSON is an invalid answer', async () => {
  const fetch = async () => new Response('<html>', { status: 200 });
  const broken = new MelimeloClient({ apiUrl: API_URL, token: TOKEN, fetch });
  await assert.rejects(broken.getHousehold(), { kind: 'invalid' });
});

test('writes go to the documented routes', async () => {
  const fake = createFakeMelimelo({ tasks: [{ id: 't 1', title: 'Arroser' }] });
  const api = client(fake);
  assert.equal(await api.addShoppingItem('Œufs', '12'), 's-100');
  assert.deepEqual(fake.data.shopping.at(-1), {
    id: 's-100',
    name: 'Œufs',
    quantity: '12',
    added_by: 'Gladys',
  });
  assert.equal(await api.createTask('Sortir le chien', '2026-11-12'), 't-101');
  await api.completeTask('t 1');
  assert.equal(fake.requests.at(-1).path, '/v1/tasks/t%201/complete');
  assert.ok(!fake.data.tasks.some((task) => task.id === 't 1'));
});

test('the normalizers tolerate the usual shapes', () => {
  assert.deepEqual(asList({ results: [1] }), [1]);
  assert.deepEqual(asList(null), []);
  assert.equal(normalizeTask({ title: 'no id' }, TZ), null);
  assert.equal(normalizeTask({ id: 1, title: 'x', completed: true }, TZ).done, true);
  assert.equal(garbageType('Ordures ménagères'), 'household');
  assert.equal(garbageType('Encombrants'), 'bulky');
  assert.equal(garbageType('Mystère'), 'other');
  assert.equal(normalizeEvent({ id: 1, title: 'x', start: 'nope' }), null);
  assert.equal(normalizeEvent({ id: 1, title: 'Férié', start: '2026-11-11' }).allDay, true);
});

test('a birthday is counted from its next occurrence', () => {
  assert.deepEqual(normalizeBirthday({ name: 'A', date: '2000-01-05' }, TZ, '2026-11-11'), {
    name: 'A',
    date: '2027-01-05',
    age: 27,
  });
  assert.deepEqual(normalizeBirthday({ name: 'B', date: '2026-11-11' }, TZ, '2026-11-11'), {
    name: 'B',
    date: '2026-11-11',
    age: null,
  });
  // February 29th, in a year without one.
  assert.equal(
    normalizeBirthday({ name: 'C', date: '2004-02-29' }, TZ, '2026-11-11').date,
    '2027-03-01',
  );
});
