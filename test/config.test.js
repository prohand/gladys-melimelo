import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, isConfigured, normalizeApiUrl, normalizeConfig } from '../src/config.js';

test('an empty config gets the defaults and is not configured', () => {
  const config = normalizeConfig();
  assert.deepEqual(config, DEFAULT_CONFIG);
  assert.equal(isConfigured(config), false);
});

test('numbers typed as strings are read, and kept within their bounds', () => {
  const config = normalizeConfig({
    sync_interval: '30',
    garbage_reminder_hour: '25',
    event_notice_minutes: '45',
  });
  assert.equal(config.sync_interval, 60);
  assert.equal(config.garbage_reminder_hour, 23);
  assert.equal(config.event_notice_minutes, 45);
  assert.equal(normalizeConfig({ sync_interval: 'abc' }).sync_interval, 300);
  assert.equal(normalizeConfig({ sync_interval: '' }).sync_interval, 300);
});

test('only https API URLs are kept (http on the loopback only)', () => {
  assert.equal(normalizeApiUrl('https://api.example.com/v1/'), 'https://api.example.com/v1');
  assert.equal(normalizeApiUrl(' https://api.example.com/v1?x=1#y '), 'https://api.example.com/v1');
  assert.equal(normalizeApiUrl('http://api.example.com/v1'), null);
  assert.equal(normalizeApiUrl('http://localhost:8080/v1'), 'http://localhost:8080/v1');
  assert.equal(normalizeApiUrl('https://user:pass@api.example.com'), null);
  assert.equal(normalizeApiUrl('ftp://api.example.com'), null);
  assert.equal(normalizeApiUrl('not a url'), null);
  assert.equal(normalizeApiUrl(''), null);
});

test('an unknown time zone falls back to the default', () => {
  assert.equal(normalizeConfig({ timezone: 'Europe/Berlin' }).timezone, 'Europe/Berlin');
  assert.equal(normalizeConfig({ timezone: 'Mars/Olympus' }).timezone, 'Europe/Paris');
});

test('a URL and a token make it configured', () => {
  const config = normalizeConfig({ api_url: 'https://api.example.com', api_token: ' abc ' });
  assert.equal(config.api_token, 'abc');
  assert.equal(isConfigured(config), true);
});
