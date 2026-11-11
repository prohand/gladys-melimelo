import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFiredStore } from '../src/melimelo/firedStore.js';

test('the fired triggers survive a restart, and are forgotten after 45 days', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'melimelo-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'sub', 'fired.json');
  let clock = Date.UTC(2026, 10, 11);

  const store = createFiredStore({ file, now: () => clock });
  store.add('birthday_today:Mamie:2026-11-11');
  await store.save();

  const restarted = createFiredStore({ file, now: () => clock });
  await restarted.load();
  assert.equal(restarted.has('birthday_today:Mamie:2026-11-11'), true);

  clock += 46 * 24 * 60 * 60 * 1000;
  const later = createFiredStore({ file, now: () => clock });
  await later.load();
  assert.equal(later.size, 0);
});

test('a broken file is not fatal', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'melimelo-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'fired.json');
  await writeFile(file, '{not json');
  const store = createFiredStore({ file });
  await store.load();
  store.add('x');
  await store.save();
  assert.deepEqual(Object.keys(JSON.parse(await readFile(file, 'utf8'))), ['x']);
});

test('without a file, the store lives in memory', async () => {
  const store = createFiredStore();
  await store.load();
  store.add('a');
  await store.save();
  assert.equal(store.has('a'), true);
});
