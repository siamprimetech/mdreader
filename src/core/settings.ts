/**
 * Reader settings: the single source of truth for how a document is rendered.
 *
 * Every visual adjustment the user can make is declared here once. The
 * settings panel is generated from these declarations, and the renderer turns
 * them into CSS custom properties, so adding a knob never means touching the
 * panel markup or the stylesheet plumbing.
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type TextAlign = 'left' | 'justify';
export type UnderlineMode = 'always' | 'hover' | 'never';

export interface ReaderSettings {
  theme: ThemeMode;
  accent: string;
  linkColor: string;
  bodyFont: string;
  monoFont: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  paragraphSpacing: number;
  headingScale: number;
  contentWidth: number;
  textAlign: TextAlign;
  linkUnderline: UnderlineMode;
  codeFontSize: number;
  imageRadius: number;
  grain: boolean;
}

export const FONT_OPTIONS = [
  { key: 'newsreader', label: 'Newsreader' },
  { key: 'literata', label: 'Literata' },
  { key: 'source-serif-4', label: 'Source Serif 4' },
  { key: 'public-sans', label: 'Public Sans' },
  { key: 'ibm-plex-sans', label: 'IBM Plex Sans' },
  { key: 'source-sans-3', label: 'Source Sans 3' },
] as const;

export const MONO_FONT_OPTIONS = [
  { key: 'jetbrains-mono', label: 'JetBrains Mono' },
  { key: 'ibm-plex-mono', label: 'IBM Plex Mono' },
] as const;

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'system',
  accent: '#c0442a',
  linkColor: '#a63a22',
  bodyFont: 'newsreader',
  monoFont: 'jetbrains-mono',
  fontSize: 18,
  lineHeight: 1.7,
  letterSpacing: 0,
  wordSpacing: 0,
  paragraphSpacing: 1.1,
  headingScale: 1,
  contentWidth: 720,
  textAlign: 'left',
  linkUnderline: 'hover',
  codeFontSize: 0.88,
  imageRadius: 6,
  grain: true,
};

export interface SettingOption {
  value: string;
  label: string;
}

/**
 * A ready-made pair of colors.
 *
 * The accent and the link color are chosen together because they are seen
 * side by side, and because a single accent with a link color that clashes
 * with it is worse than either on its own.
 */
export interface ColorPreset {
  key: string;
  name: string;
  accent: string;
  link: string;
}

/**
 * The palettes on offer.
 *
 * Each one is dark enough to carry white text on the light theme and bright
 * enough to read on the dark one, so a palette works in either.
 */
export const COLOR_PRESETS: ColorPreset[] = [
  { key: 'vermilion', name: 'Vermilion', accent: '#c0442a', link: '#a63a22' },
  { key: 'indigo', name: 'Indigo', accent: '#4c5aa8', link: '#3b4789' },
  { key: 'forest', name: 'Forest', accent: '#3d7355', link: '#2f5a43' },
  { key: 'plum', name: 'Plum', accent: '#8a4470', link: '#6e3659' },
  { key: 'ochre', name: 'Ochre', accent: '#97691c', link: '#775213' },
  { key: 'teal', name: 'Teal', accent: '#2c7070', link: '#215959' },
  { key: 'slate', name: 'Slate', accent: '#4a5568', link: '#3a4456' },
];

/** The preset that matches the current colors, if there is one. */
export function matchingPreset(settings: ReaderSettings): ColorPreset | undefined {
  return COLOR_PRESETS.find(
    (preset) =>
      preset.accent === settings.accent.toLowerCase() &&
      preset.link === settings.linkColor.toLowerCase(),
  );
}

export interface RangeDefinition {
  kind: 'range';
  key: keyof ReaderSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  format?: (value: number) => string;
}

export interface SelectDefinition {
  kind: 'select';
  key: keyof ReaderSettings;
  label: string;
  options: SettingOption[];
}

export interface SegmentedDefinition {
  kind: 'segmented';
  key: keyof ReaderSettings;
  label: string;
  options: SettingOption[];
}

export interface ColorDefinition {
  kind: 'color';
  key: keyof ReaderSettings;
  label: string;
}

export interface ToggleDefinition {
  kind: 'toggle';
  key: keyof ReaderSettings;
  label: string;
}

export interface PresetsDefinition {
  kind: 'presets';
  label: string;
  presets: ColorPreset[];
}

export type SettingDefinition =
  | RangeDefinition
  | SelectDefinition
  | SegmentedDefinition
  | ColorDefinition
  | ToggleDefinition
  | PresetsDefinition;

export interface SettingGroup {
  title: string;
  hint: string;
  settings: SettingDefinition[];
}

export const SETTING_GROUPS: SettingGroup[] = [
  {
    title: 'Theme',
    hint: 'Pick a palette, or set the colors yourself.',
    settings: [
      {
        kind: 'segmented',
        key: 'theme',
        label: 'Appearance',
        options: [
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
          { value: 'system', label: 'System' },
        ],
      },
      {
        kind: 'presets',
        label: 'Palette',
        presets: COLOR_PRESETS,
      },
      { kind: 'color', key: 'accent', label: 'Accent' },
      { kind: 'toggle', key: 'grain', label: 'Paper grain' },
    ],
  },
  {
    title: 'Links',
    hint: 'Where the page sends you, and how it says so.',
    settings: [
      { kind: 'color', key: 'linkColor', label: 'Link color' },
      {
        kind: 'select',
        key: 'linkUnderline',
        label: 'Link underline',
        options: [
          { value: 'always', label: 'Always' },
          { value: 'hover', label: 'On hover' },
          { value: 'never', label: 'Never' },
        ],
      },
    ],
  },
  {
    title: 'Typography',
    hint: 'The shape of a page is personal. Nothing here is fixed.',
    settings: [
      {
        kind: 'select',
        key: 'bodyFont',
        label: 'Body face',
        options: FONT_OPTIONS.map((font) => ({ value: font.key, label: font.label })),
      },
      {
        kind: 'select',
        key: 'monoFont',
        label: 'Code face',
        options: MONO_FONT_OPTIONS.map((font) => ({ value: font.key, label: font.label })),
      },
      { kind: 'range', key: 'fontSize', label: 'Size', min: 13, max: 30, step: 1, unit: 'px' },
      { kind: 'range', key: 'lineHeight', label: 'Line height', min: 1.2, max: 2.4, step: 0.05, unit: '×' },
      {
        kind: 'range',
        key: 'letterSpacing',
        label: 'Letter spacing',
        min: -0.03,
        max: 0.12,
        step: 0.005,
        unit: 'em',
        format: (value) => value.toFixed(3),
      },
      {
        kind: 'range',
        key: 'wordSpacing',
        label: 'Word spacing',
        min: 0,
        max: 0.4,
        step: 0.01,
        unit: 'em',
        format: (value) => value.toFixed(2),
      },
      {
        kind: 'range',
        key: 'paragraphSpacing',
        label: 'Paragraph spacing',
        min: 0.2,
        max: 2.6,
        step: 0.05,
        unit: 'em',
        format: (value) => value.toFixed(2),
      },
      {
        kind: 'range',
        key: 'headingScale',
        label: 'Heading scale',
        min: 0.8,
        max: 1.6,
        step: 0.05,
        unit: '×',
        format: (value) => value.toFixed(2),
      },
      {
        kind: 'select',
        key: 'textAlign',
        label: 'Alignment',
        options: [
          { value: 'left', label: 'Ragged right' },
          { value: 'justify', label: 'Justified' },
        ],
      },
    ],
  },
  {
    title: 'Layout',
    hint: 'How much room the page takes before the margins close in.',
    settings: [
      { kind: 'range', key: 'contentWidth', label: 'Column width', min: 460, max: 1180, step: 10, unit: 'px' },
      { kind: 'range', key: 'imageRadius', label: 'Image corners', min: 0, max: 28, step: 1, unit: 'px' },
    ],
  },
  {
    title: 'Code',
    hint: 'Snippets keep their own voice, but follow the page otherwise.',
    settings: [
      { kind: 'range', key: 'codeFontSize', label: 'Code size', min: 0.65, max: 1.2, step: 0.01, unit: '×', format: (value) => value.toFixed(2) },
    ],
  },
];

const THEME_MODES: ThemeMode[] = ['light', 'dark', 'system'];
const TEXT_ALIGNS: TextAlign[] = ['left', 'justify'];
const UNDERLINE_MODES: UnderlineMode[] = ['always', 'hover', 'never'];
const BODY_FONT_KEYS = FONT_OPTIONS.map((font) => font.key);
const MONO_FONT_KEYS = MONO_FONT_OPTIONS.map((font) => font.key);

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Coerces a stored value into one of the allowed options, or falls back. */
function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function numberIn(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function hexColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value.toLowerCase() : fallback;
}

/**
 * Turns arbitrary persisted data into trusted settings.
 *
 * Anything missing, malformed or out of range is replaced by the default for
 * that field, so a corrupted store can never break the reader.
 */
export function parseSettings(raw: unknown): ReaderSettings {
  if (!isRecord(raw)) return { ...DEFAULT_SETTINGS };

  return {
    theme: oneOf(raw.theme, THEME_MODES, DEFAULT_SETTINGS.theme),
    accent: hexColor(raw.accent, DEFAULT_SETTINGS.accent),
    linkColor: hexColor(raw.linkColor, DEFAULT_SETTINGS.linkColor),
    bodyFont: oneOf(raw.bodyFont, BODY_FONT_KEYS, DEFAULT_SETTINGS.bodyFont),
    monoFont: oneOf(raw.monoFont, MONO_FONT_KEYS, DEFAULT_SETTINGS.monoFont),
    fontSize: numberIn(raw.fontSize, 13, 30, DEFAULT_SETTINGS.fontSize),
    lineHeight: numberIn(raw.lineHeight, 1.2, 2.4, DEFAULT_SETTINGS.lineHeight),
    letterSpacing: numberIn(raw.letterSpacing, -0.03, 0.12, DEFAULT_SETTINGS.letterSpacing),
    wordSpacing: numberIn(raw.wordSpacing, 0, 0.4, DEFAULT_SETTINGS.wordSpacing),
    paragraphSpacing: numberIn(raw.paragraphSpacing, 0.2, 2.6, DEFAULT_SETTINGS.paragraphSpacing),
    headingScale: numberIn(raw.headingScale, 0.8, 1.6, DEFAULT_SETTINGS.headingScale),
    contentWidth: numberIn(raw.contentWidth, 460, 1180, DEFAULT_SETTINGS.contentWidth),
    textAlign: oneOf(raw.textAlign, TEXT_ALIGNS, DEFAULT_SETTINGS.textAlign),
    linkUnderline: oneOf(raw.linkUnderline, UNDERLINE_MODES, DEFAULT_SETTINGS.linkUnderline),
    codeFontSize: numberIn(raw.codeFontSize, 0.65, 1.2, DEFAULT_SETTINGS.codeFontSize),
    imageRadius: numberIn(raw.imageRadius, 0, 28, DEFAULT_SETTINGS.imageRadius),
    grain: typeof raw.grain === 'boolean' ? raw.grain : DEFAULT_SETTINGS.grain,
  };
}
