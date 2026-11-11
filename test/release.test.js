import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollChangelog } from '../.github/scripts/changelog-release.mjs';

const BEFORE = `# Changelog

## [Unreleased]

### Added

- A thing.

## [1.0.0] - 2026-11-11

- First release.

[Unreleased]: https://github.com/prohand/gladys-melimelo/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/prohand/gladys-melimelo/releases/tag/v1.0.0
`;

test('the release moves Unreleased under the new version and updates the links', () => {
  const after = rollChangelog(BEFORE, '1.1.0', '2026-12-01');
  assert.match(
    after,
    /## \[Unreleased\]\n\n## \[1\.1\.0\] - 2026-12-01\n\n### Added\n\n- A thing\./,
  );
  assert.match(after, /\[Unreleased\]: .*compare\/v1\.1\.0\.\.\.HEAD/);
  assert.match(after, /\[1\.1\.0\]: .*compare\/v1\.0\.0\.\.\.v1\.1\.0/);
});

test('an empty Unreleased section still names the release', () => {
  const after = rollChangelog(rollChangelog(BEFORE, '1.1.0', '2026-12-01'), '1.1.1', '2026-12-02');
  assert.match(
    after,
    /## \[1\.1\.1\] - 2026-12-02\n\n- Maintenance release, no functional change\./,
  );
});

test('releasing the same version twice changes nothing', () => {
  const once = rollChangelog(BEFORE, '1.1.0', '2026-12-01');
  assert.equal(rollChangelog(once, '1.1.0', '2026-12-01'), once);
});
