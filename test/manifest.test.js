// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_CONFIG } from '../src/config.js';
import { GARBAGE_TYPES } from '../src/melimelo/client.js';
import { SCENE_TRIGGERS, TRIGGER_DATA_KEYS } from '../src/capabilities/triggers.js';
import { SCENE_ACTIONS, SCENE_ACTION_OUTPUTS } from '../src/capabilities/scenes.js';
import { HOUSEHOLD_WIDGET, WIDGET_LISTS } from '../src/capabilities/widget.js';
import { LANGUAGES } from '../src/i18n.js';

const read = async (path) => readFile(new URL(path, import.meta.url), 'utf8');
const manifest = JSON.parse(await read('../gladys-assistant-integration.json'));
const packageJson = JSON.parse(await read('../package.json'));
const appSource = await read('../src/app.js');

test('version and image tag stay in lockstep with package.json', () => {
  assert.equal(manifest.version, packageJson.version);
  assert.equal(manifest.docker_image, `ghcr.io/prohand/gladys-melimelo:${packageJson.version}`);
});

test('Melimelo is a cloud service: the manifest declares the cloud transport only', () => {
  assert.deepEqual(manifest.transports, ['cloud']);
});

test('every manifest action is registered', () => {
  for (const action of manifest.actions ?? []) {
    assert.match(appSource, new RegExp(`onAction\\('${action.key}'`), `action "${action.key}"`);
  }
});

// The store schema is the admission authority: a field type outside this list,
// or a placeholder that is not a multi-language object, gets the integration
// rejected by the indexer.
const FIELD_TYPES = ['string', 'number', 'boolean', 'select', 'multi_select', 'secret', 'section'];

test('every field uses a type the store accepts', () => {
  const allFields = [
    ...manifest.config_schema,
    ...(manifest.actions ?? []).flatMap((a) => a.fields ?? []),
    ...(manifest.widgets ?? []).flatMap((w) => w.settings ?? []),
    ...(manifest.scene_triggers ?? []).flatMap((t) => t.fields ?? []),
    ...(manifest.scene_actions ?? []).flatMap((a) => a.fields ?? []),
  ];
  for (const field of allFields) {
    assert.ok(FIELD_TYPES.includes(field.type), `field "${field.key}": type "${field.type}"`);
    assert.match(field.key, /^[a-z0-9_]+$/, `field key "${field.key}" must be snake_case`);
    if (field.placeholder !== undefined) {
      assert.equal(typeof field.placeholder, 'object', `field "${field.key}": placeholder object`);
      assert.ok(
        ['string', 'number', 'secret'].includes(field.type),
        `field "${field.key}": a ${field.type} field cannot have a placeholder`,
      );
    }
    if (field.min !== undefined || field.max !== undefined) {
      assert.equal(field.type, 'number', `field "${field.key}": min/max are number-only`);
    }
  }
});

test('the access token is a secret field', () => {
  const token = manifest.config_schema.find((field) => field.key === 'api_token');
  assert.equal(token.type, 'secret');
  assert.equal(token.default, undefined, 'a secret never has a default');
});

test('the description fits what the store allows', () => {
  assert.ok(manifest.name.length >= 3 && manifest.name.length <= 30);
});

test('config_schema defaults stay consistent with DEFAULT_CONFIG', () => {
  for (const field of manifest.config_schema) {
    if (field.type === 'section') {
      assert.ok(!(field.key in DEFAULT_CONFIG), `section "${field.key}" stores no value`);
      assert.equal(field.required, undefined);
      assert.equal(field.default, undefined);
      for (const link of field.links ?? []) assert.match(link.url, /^https:\/\//);
      continue;
    }
    assert.ok(field.key in DEFAULT_CONFIG, `config key "${field.key}" missing in DEFAULT_CONFIG`);
    if (field.default !== undefined) {
      assert.equal(DEFAULT_CONFIG[field.key], field.default, `default of "${field.key}"`);
    }
  }
});

// The vocabulary the store indexes. An unknown category is dropped silently.
const CATEGORIES = [
  'climate',
  'lighting',
  'energy',
  'security',
  'multimedia',
  'appliances',
  'environment',
  'protocols',
  'network',
  'notifications',
  'assistants',
  'services',
  'transport',
  'vehicles',
  'servers',
  'leisure',
];

test('the categories stay inside the vocabulary the store indexes', () => {
  const { categories } = manifest;
  assert.ok(categories.length >= 1 && categories.length <= 3);
  assert.equal(new Set(categories).size, categories.length);
  for (const category of categories) assert.ok(CATEGORIES.includes(category), category);
});

test('the Gladys floor covers every field the manifest declares', () => {
  // Widgets and scene declarations need 5.1, widget forms 5.2, keywords 5.3.
  const [major, minor] = manifest.gladys_version.replace(/^>=/, '').split('.').map(Number);
  assert.ok(major > 5 || (major === 5 && minor >= 3), `got ${manifest.gladys_version}`);
});

test('the search keywords follow the store rules', () => {
  const { keywords } = manifest;
  assert.ok(Array.isArray(keywords) && keywords.length >= 1 && keywords.length <= 10);
  const normalized = keywords.map((keyword) => keyword.trim().toLowerCase());
  assert.equal(new Set(normalized).size, keywords.length, 'keywords must be unique');
  for (const keyword of normalized) assert.ok(keyword.length >= 2 && keyword.length <= 30);
});

test('the scene triggers the code fires are the ones the manifest declares, with their data', () => {
  const declared = manifest.scene_triggers;
  assert.deepEqual(
    declared.map((trigger) => trigger.key).sort(),
    Object.values(SCENE_TRIGGERS).sort(),
  );
  for (const trigger of declared) {
    const keys = [...(trigger.fields ?? []), ...(trigger.variables ?? [])].map((f) => f.key);
    assert.deepEqual(keys.sort(), [...TRIGGER_DATA_KEYS[trigger.key]].sort(), trigger.key);
  }
  const garbage = declared.find((t) => t.key === SCENE_TRIGGERS.GARBAGE_COLLECTION_TOMORROW);
  assert.deepEqual(
    garbage.fields[0].options.map((option) => option.value),
    GARBAGE_TYPES,
  );
});

test('every scene action is handled, with the outputs it declares', () => {
  const declared = manifest.scene_actions;
  assert.deepEqual(
    declared.map((action) => action.key).sort(),
    Object.values(SCENE_ACTIONS).sort(),
  );
  for (const action of declared) {
    assert.deepEqual(
      action.outputs.map((output) => output.key).sort(),
      [...SCENE_ACTION_OUTPUTS[action.key]].sort(),
      action.key,
    );
  }
  assert.match(appSource, /onSceneAction\(key, handler\)/);
});

test('the widget is handled and its list setting matches the code', () => {
  assert.deepEqual(
    manifest.widgets.map((widget) => widget.key),
    [HOUSEHOLD_WIDGET],
  );
  assert.match(appSource, /onWidgetGet\(HOUSEHOLD_WIDGET/);
  assert.match(appSource, /onWidgetAction\(HOUSEHOLD_WIDGET/);
  const list = manifest.widgets[0].settings.find((setting) => setting.key === 'list');
  assert.deepEqual(
    list.options.map((option) => option.value),
    WIDGET_LISTS,
  );
});

/** Every multi-language object of the manifest, with where it sits. */
function multiLanguageTexts(node, path = 'manifest') {
  if (Array.isArray(node)) {
    return node.flatMap((child, index) => multiLanguageTexts(child, `${path}[${index}]`));
  }
  if (node === null || typeof node !== 'object') return [];
  const keys = Object.keys(node);
  if (keys.includes('en') && keys.every((key) => /^[a-z]{2}$/.test(key))) {
    return [{ path, text: node }];
  }
  return keys.flatMap((key) => multiLanguageTexts(node[key], `${path}.${key}`));
}

test('every multi-language text of the manifest carries en, fr, de and es', () => {
  // Gladys shows the reader's language and falls back to English: a text
  // missing one of them shows up in English in the middle of a translated
  // screen. The store accepts any two-letter key, so nothing else catches it.
  const texts = multiLanguageTexts(manifest);
  assert.ok(texts.length > 50, `only ${texts.length} texts found`);
  for (const { path, text } of texts) {
    assert.deepEqual(Object.keys(text).sort(), [...LANGUAGES].sort(), `${path}: languages`);
    for (const language of LANGUAGES) {
      assert.ok(text[language].trim().length > 0, `${path}.${language} is empty`);
    }
  }
});

test('the per-language length limits of the store hold in every language', () => {
  const within = (text, min, max, where) => {
    for (const language of LANGUAGES) {
      const { length } = text[language];
      assert.ok(length >= min && length <= max, `${where}.${language}: ${length} characters`);
    }
  };
  within(manifest.description, 10, 100, 'description');
  for (const widget of manifest.widgets) {
    within(widget.label, 3, 30, `widget ${widget.key} label`);
    within(widget.description, 1, 100, `widget ${widget.key} description`);
  }
  for (const section of manifest.config_schema.filter((field) => field.type === 'section')) {
    within(section.description, 1, 1000, `section ${section.key} description`);
  }
});

test('the user documentation exists in every language', async () => {
  for (const language of LANGUAGES) {
    const text = await read(`../docs/${language}.md`);
    assert.ok(text.length > 1000, `docs/${language}.md is too short`);
    for (const key of [...Object.values(SCENE_TRIGGERS), ...Object.values(SCENE_ACTIONS)]) {
      assert.ok(text.includes(key), `docs/${language}.md does not name "${key}"`);
    }
  }
});
