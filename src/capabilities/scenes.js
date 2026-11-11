// -----------------------------------------------------------------------------
// Scene actions (Gladys 5.1+): what a scene can DO in Melimelo.
//
// Declared in the manifest `scene_actions`, registered by src/app.js with
// `gladys.onSceneAction(key, ...)`. The handler receives the RESOLVED fields
// (scene variables substituted, defaults applied) and returns the declared
// scalar outputs. Throwing fails this action only: the scene logs it and goes
// on. A missing task is an OUTPUT (`completed: false`), not a failure — a
// scene action is never a condition, the scene author gates on the output.
//
// Keys are forever: scenes store them, so a published key is never renamed.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { isDay } from '../time.js';

const logger = createLogger({ name: 'scenes' });

export const SCENE_ACTIONS = {
  ADD_SHOPPING_ITEM: 'add_shopping_item',
  CREATE_TASK: 'create_task',
  COMPLETE_TASK: 'complete_task',
  SYNC_NOW: 'sync_now',
};

/** The output keys each action resolves: the manifest `outputs` (tested). */
export const SCENE_ACTION_OUTPUTS = {
  [SCENE_ACTIONS.ADD_SHOPPING_ITEM]: ['added'],
  [SCENE_ACTIONS.CREATE_TASK]: ['task_id'],
  [SCENE_ACTIONS.COMPLETE_TASK]: ['completed'],
  [SCENE_ACTIONS.SYNC_NOW]: ['tasks_open', 'shopping_items'],
};

function requiredText(value, field, max) {
  const text = String(value ?? '').trim();
  if (text === '') throw new Error(`"${field}" is empty`);
  return text.slice(0, max);
}

/** Same title, whatever the case and the accents. */
function sameTitle(a, b) {
  const fold = (text) =>
    text
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toLowerCase();
  return fold(a) === fold(b);
}

/**
 * Add an item to the shopping list. Shared by the scene action and the
 * dashboard widget form.
 */
export async function addShoppingItem({ client, sync }, name, quantity) {
  const item = requiredText(name, 'item', 120);
  const amount =
    String(quantity ?? '')
      .trim()
      .slice(0, 40) || null;
  const id = await client.addShoppingItem(item, amount);
  // Before the sync: the new item must not come back as "an item was added".
  sync.rememberOwnItem(id, item);
  await sync.sync();
  return item;
}

/**
 * The scene action handlers.
 * @param {object} deps
 * @param {() => object} deps.getClient MelimeloClient for the current config (throws when not configured)
 * @param {object} deps.sync the synchronization loop
 */
export function createSceneActions({ getClient, sync }) {
  return {
    async [SCENE_ACTIONS.ADD_SHOPPING_ITEM](fields) {
      await addShoppingItem({ client: getClient(), sync }, fields.item, fields.quantity);
      return { added: true };
    },

    async [SCENE_ACTIONS.CREATE_TASK](fields) {
      const title = requiredText(fields.title, 'title', 200);
      const due = String(fields.due_date ?? '').trim();
      if (due !== '' && !isDay(due)) throw new Error(`"due_date" must be YYYY-MM-DD, got "${due}"`);
      const id = await getClient().createTask(title, due || null);
      await sync.sync();
      return { task_id: id ?? '' };
    },

    async [SCENE_ACTIONS.COMPLETE_TASK](fields) {
      const title = requiredText(fields.title, 'title', 200);
      const client = getClient();
      // Read fresh: the task may have been created a minute ago, after the last sync.
      const snapshot = await sync.sync();
      const task = snapshot?.tasks.find((candidate) => sameTitle(candidate.title, title));
      if (!task) {
        logger.info(`complete_task: no open task named "${title}"`);
        return { completed: false };
      }
      await client.completeTask(task.id);
      await sync.sync();
      return { completed: true };
    },

    async [SCENE_ACTIONS.SYNC_NOW]() {
      const snapshot = await sync.sync();
      if (!snapshot)
        throw new Error('Melimelo could not be synchronized, see the integration logs');
      return {
        tasks_open: sync.state.summary.tasksOpen,
        shopping_items: sync.state.summary.shoppingItems,
      };
    },
  };
}
