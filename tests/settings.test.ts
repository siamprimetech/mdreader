import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_SETTINGS, COLOR_PRESETS, matchingPreset, parseSettings } from '../src/core/settings.ts';

test('an empty store yields the shipped defaults', () => {
  assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings('nonsense'), DEFAULT_SETTINGS);
});

test('unknown keys are ignored', () => {
  const settings = parseSettings({ fontSize: 20, nonsense: 'value' });
  assert.equal(settings.fontSize, 20);
  assert.equal('nonsense' in settings, false);
});

test('numbers outside their range are brought back inside it', () => {
  assert.equal(parseSettings({ fontSize: 999 }).fontSize, 30);
  assert.equal(parseSettings({ fontSize: 1 }).fontSize, 13);
  assert.equal(parseSettings({ contentWidth: 100000 }).contentWidth, 1180);
});

test('a stored value below the range is clamped, not discarded', () => {
  // A slider dragged to its end stores the smallest value it allows, so a
  // number that is merely too small still describes an intention.
  assert.equal(parseSettings({ lineHeight: 0 }).lineHeight, 1.2);
  assert.equal(parseSettings({ imageRadius: 0 }).imageRadius, 0);
});

test('values that are not numbers fall back to the default', () => {
  assert.equal(parseSettings({ fontSize: 'large' }).fontSize, DEFAULT_SETTINGS.fontSize);
  assert.equal(parseSettings({ fontSize: Number.NaN }).fontSize, DEFAULT_SETTINGS.fontSize);
  assert.equal(parseSettings({ lineHeight: 'loose' }).lineHeight, DEFAULT_SETTINGS.lineHeight);
});

test('colors must be six digit hex', () => {
  assert.equal(parseSettings({ accent: '#C0442A' }).accent, '#c0442a');
  assert.equal(parseSettings({ accent: 'red' }).accent, DEFAULT_SETTINGS.accent);
  assert.equal(parseSettings({ accent: '#fff' }).accent, DEFAULT_SETTINGS.accent);
});

test('options outside the allowed set fall back', () => {
  assert.equal(parseSettings({ theme: 'sepia' }).theme, DEFAULT_SETTINGS.theme);
  assert.equal(parseSettings({ bodyFont: 'comic-sans' }).bodyFont, DEFAULT_SETTINGS.bodyFont);
  assert.equal(parseSettings({ textAlign: 'center' }).textAlign, DEFAULT_SETTINGS.textAlign);
});

test('booleans are kept as they are', () => {
  assert.equal(parseSettings({ grain: false }).grain, false);
  assert.equal(parseSettings({ grain: 'yes' }).grain, DEFAULT_SETTINGS.grain);
});

test('every setting survives a round trip unchanged', () => {
  assert.deepEqual(parseSettings(DEFAULT_SETTINGS), DEFAULT_SETTINGS);
});

test('every palette is a pair of valid colors', () => {
  for (const preset of COLOR_PRESETS) {
    assert.match(preset.accent, /^#[0-9a-f]{6}$/, preset.key);
    assert.match(preset.link, /^#[0-9a-f]{6}$/, preset.key);
    assert.ok(preset.name.length > 0, preset.key);
  }
});

test('a palette survives being applied', () => {
  for (const preset of COLOR_PRESETS) {
    const settings = parseSettings({ accent: preset.accent, linkColor: preset.link });
    assert.equal(settings.accent, preset.accent);
    assert.equal(settings.linkColor, preset.link);
  }
});

test('the palette in use is recognized', () => {
  assert.equal(matchingPreset(DEFAULT_SETTINGS)?.key, 'vermilion');
  assert.equal(matchingPreset(parseSettings({ accent: '#4c5aa8', linkColor: '#3b4789' }))?.key, 'indigo');
});

test('a color of your own matches no palette', () => {
  assert.equal(matchingPreset(parseSettings({ accent: '#123456', linkColor: '#654321' })), undefined);
});
