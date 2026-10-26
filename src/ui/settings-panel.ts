/**
 * The settings drawer.
 *
 * Every control is generated from the declarations in `core/settings.ts`, so a
 * new knob appears here automatically once it is described there.
 *
 * The panel is built once and then kept in step by `sync`, rather than being
 * rebuilt on every change: rebuilding would tear the slider out from under
 * the pointer while it is being dragged.
 */

import {
  SETTING_GROUPS,
  type ColorPreset,
  type ReaderSettings,
  type SettingDefinition,
} from '../core/settings.ts';
import { h } from './dom.ts';

export interface SettingsPanel {
  element: HTMLElement;
  /** Builds the controls. Nothing is built until this is called. */
  render(settings: ReaderSettings): void;
  sync(settings: ReaderSettings): void;
  /** Whether the controls have been built yet. */
  readonly isBuilt: boolean;
}

interface PanelOptions {
  onChange: (change: Partial<ReaderSettings>) => void;
  onReset: () => void;
  onClearRecents: () => void;
}

interface ControlBinding {
  key: keyof ReaderSettings;
  update: (settings: ReaderSettings) => void;
}

/** A preset counts as chosen only when both of its colors are in place. */
function isPresetActive(preset: ColorPreset, settings: ReaderSettings): boolean {
  return (
    preset.accent === settings.accent.toLowerCase() &&
    preset.link === settings.linkColor.toLowerCase()
  );
}

function formatValue(definition: SettingDefinition, value: number): string {
  if (definition.kind !== 'range') return String(value);
  const formatted = definition.format?.(value) ?? String(value);
  return `${formatted}${definition.unit}`;
}

function createControl(
  definition: SettingDefinition,
  settings: ReaderSettings,
  options: PanelOptions,
): { element: HTMLElement; binding: ControlBinding } {
  switch (definition.kind) {
    case 'range': {
      const value = settings[definition.key];
      const readout = h('output', {
        class: 'control__value',
        text: formatValue(definition, Number(value)),
      });

      const slider = h('input', {
        type: 'range',
        class: 'control__slider',
        min: definition.min,
        max: definition.max,
        step: definition.step,
        value: String(value),
        'aria-label': definition.label,
        oninput: (event: Event) => {
          const next = Number((event.target as HTMLInputElement).value);
          readout.textContent = formatValue(definition, next);
          options.onChange({ [definition.key]: next } as Partial<ReaderSettings>);
        },
      });

      return {
        element: h('div', { class: 'control control--range' }, [
          h('div', { class: 'control__head' }, [
            h('span', { class: 'control__label', text: definition.label }),
            readout,
          ]),
          slider,
        ]),
        binding: {
          key: definition.key,
          update: (current) => {
            const numeric = Number(current[definition.key]);
            slider.value = String(numeric);
            readout.textContent = formatValue(definition, numeric);
          },
        },
      };
    }

    case 'segmented': {
      const value = settings[definition.key];
      const buttons = definition.options.map((option) =>
        h('button', {
          type: 'button',
          class: 'segmented__option',
          'data-active': String(option.value === value),
          'data-value': option.value,
          text: option.label,
          onclick: () => {
            for (const button of buttons) {
              button.dataset.active = String(button.dataset.value === option.value);
            }
            options.onChange({ [definition.key]: option.value } as Partial<ReaderSettings>);
          },
        }),
      );

      return {
        element: h('div', { class: 'control control--segmented' }, [
          h('span', { class: 'control__label', text: definition.label }),
          h('div', { class: 'segmented' }, buttons),
        ]),
        binding: {
          key: definition.key,
          update: (current) => {
            const chosen = String(current[definition.key]);
            for (const button of buttons) {
              button.dataset.active = String(button.dataset.value === chosen);
            }
          },
        },
      };
    }

    case 'select': {
      const value = settings[definition.key];
      const select = h(
        'select',
        {
          class: 'control__select',
          'aria-label': definition.label,
          onchange: (event: Event) => {
            const next = (event.target as HTMLSelectElement).value;
            options.onChange({ [definition.key]: next } as Partial<ReaderSettings>);
          },
        },
        definition.options.map((option) =>
          h('option', {
            value: option.value,
            text: option.label,
            selected: option.value === value,
          }),
        ),
      );

      return {
        element: h('div', { class: 'control control--select' }, [
          h('span', { class: 'control__label', text: definition.label }),
          select,
        ]),
        binding: {
          key: definition.key,
          update: (current) => {
            select.value = String(current[definition.key]);
          },
        },
      };
    }

    case 'color': {
      const value = settings[definition.key];
      const swatch = h('input', {
        type: 'color',
        class: 'control__color',
        value: String(value),
        'aria-label': definition.label,
        oninput: (event: Event) => {
          const next = (event.target as HTMLInputElement).value;
          hex.value = next.toUpperCase();
          options.onChange({ [definition.key]: next } as Partial<ReaderSettings>);
        },
      });

      const hex = h('input', {
        type: 'text',
        class: 'control__hex',
        value: String(value).toUpperCase(),
        spellcheck: 'false',
        'aria-label': `${definition.label} hex value`,
        onchange: (event: Event) => {
          const next = (event.target as HTMLInputElement).value.trim();
          options.onChange({ [definition.key]: next } as Partial<ReaderSettings>);
        },
      });

      return {
        element: h('div', { class: 'control control--color' }, [
          h('span', { class: 'control__label', text: definition.label }),
          h('div', { class: 'control__color-row' }, [swatch, hex]),
        ]),
        binding: {
          key: definition.key,
          update: (current) => {
            const chosen = String(current[definition.key]);
            swatch.value = chosen;
            hex.value = chosen.toUpperCase();
          },
        },
      };
    }

    case 'presets': {
      const swatches: HTMLElement[] = [];

      for (const preset of definition.presets) {
        const swatch = h(
          'button',
          {
            type: 'button',
            class: 'swatch',
            title: preset.name,
            'aria-label': preset.name,
            'data-active': String(isPresetActive(preset, settings)),
            style: `--swatch: ${preset.accent}`,
          },
        );

        swatch.addEventListener('click', () => {
          for (const other of swatches) other.dataset.active = 'false';
          swatch.dataset.active = 'true';
          options.onChange({ accent: preset.accent, linkColor: preset.link });
        });

        swatches.push(swatch);
      }

      return {
        element: h('div', { class: 'control control--presets' }, [
          h('span', { class: 'control__label', text: definition.label }),
          h('div', { class: 'swatches' }, swatches),
        ]),
        binding: {
          key: 'accent',
          update: (current) => {
            definition.presets.forEach((preset, index) => {
              const swatch = swatches[index];
              if (swatch) swatch.dataset.active = String(isPresetActive(preset, current));
            });
          },
        },
      };
    }

    case 'toggle': {
      const value = settings[definition.key];
      const input = h('input', {
        type: 'checkbox',
        class: 'control__switch-input',
        checked: Boolean(value),
        'aria-label': definition.label,
        onchange: (event: Event) => {
          options.onChange({
            [definition.key]: (event.target as HTMLInputElement).checked,
          } as Partial<ReaderSettings>);
        },
      });

      return {
        element: h('div', { class: 'control control--toggle' }, [
          h('span', { class: 'control__label', text: definition.label }),
          h('label', { class: 'control__switch' }, [
            input,
            h('span', { class: 'control__switch-track' }),
          ]),
        ]),
        binding: {
          key: definition.key,
          update: (current) => {
            input.checked = Boolean(current[definition.key]);
          },
        },
      };
    }
  }
}

export function createSettingsPanel(options: PanelOptions): SettingsPanel {
  const body = h('div', { class: 'settings__body' });

  const element = h('aside', { class: 'settings', id: 'settings', 'aria-hidden': 'true' }, [
    h('header', { class: 'settings__header' }, [
      h('div', {}, [
        h('h2', { class: 'settings__title', text: 'Reading' }),
        h('p', { class: 'settings__subtitle', text: 'Every change applies instantly.' }),
      ]),
      h('button', {
        type: 'button',
        class: 'icon-button',
        'aria-label': 'Close settings',
        title: 'Close settings',
        'data-action': 'close-settings',
      }),
    ]),
    body,
    h('footer', { class: 'settings__footer' }, [
      h('button', {
        type: 'button',
        class: 'text-button',
        text: 'Clear recent files',
        onclick: options.onClearRecents,
      }),
      h('button', {
        type: 'button',
        class: 'text-button',
        text: 'Reset to defaults',
        onclick: options.onReset,
      }),
    ]),
  ]);

  let bindings: ControlBinding[] = [];

  function render(settings: ReaderSettings): void {
    body.replaceChildren();
    bindings = [];

    for (const group of SETTING_GROUPS) {
      const section = h('section', { class: 'settings__group' }, [
        h('h3', { class: 'settings__group-title', text: group.title }),
        h('p', { class: 'settings__group-hint', text: group.hint }),
      ]);

      for (const definition of group.settings) {
        const control = createControl(definition, settings, options);
        bindings.push(control.binding);
        section.append(control.element);
      }

      body.append(section);
    }
  }

  function sync(settings: ReaderSettings): void {
    for (const binding of bindings) {
      binding.update(settings);
    }
  }

  return {
    element,
    render,
    sync,
    get isBuilt(): boolean {
      return bindings.length > 0;
    },
  };
}
