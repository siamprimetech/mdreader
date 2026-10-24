import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

const licenses = readFileSync(
  new URL('../THIRD_PARTY_LICENSES.md', import.meta.url),
  'utf8',
);

/**
 * Whether a package is listed in the table.
 *
 * The table is formatted as markdown, and the padding around the columns is
 * not fixed, so the name is looked for loosely.
 */
function listsPackage(name: string): boolean {
  return new RegExp(`\\|\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\|`).test(
    licenses,
  );
}

test('every dependency is listed in the third-party licenses', () => {
  const missing: string[] = [];

  for (const name of [
    ...Object.keys(packageJson.dependencies),
    ...Object.keys(packageJson.devDependencies),
  ]) {
    if (!listsPackage(name)) missing.push(name);
  }

  assert.deepEqual(missing, [], 'run tools/collect-licenses.py after changing a dependency');
});

test('every license that applies is reproduced in full', () => {
  // A license whose text could not be found is a gap in the notice.
  assert.equal(licenses.includes('not bundled here'), false);
});

test('the bundled typefaces are all accounted for', () => {
  const fonts = Object.keys(packageJson.dependencies).filter((name) =>
    name.startsWith('@fontsource'),
  );

  for (const font of fonts) {
    const typeface = font.split('/')[1] ?? '';
    assert.ok(licenses.includes(typeface), `${font} is not in the typeface table`);
  }
});

test('the license texts are present', () => {
  for (const name of [
    '### MIT',
    '### Apache-2.0',
    '### BSD-3-Clause',
    '### ISC',
    '### SIL Open Font License 1.1',
  ]) {
    assert.ok(licenses.includes(name), `${name} is missing`);
  }
});
