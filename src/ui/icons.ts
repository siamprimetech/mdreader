/**
 * Interface icons, drawn as inline SVG so they inherit the current text color
 * and need no additional requests.
 */

const PATHS = {
  outline: '<path d="M4 6h16M4 12h11M4 18h7"/><path d="M20 15.5v5m0 0 2-2m-2 2-2-2"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/>',
  moon: '<path d="M20 14.2A8.4 8.4 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2Z"/>',
  sliders:
    '<path d="M4 8h10M18 8h2M4 16h4M12 16h8"/><circle cx="16" cy="8" r="2.2"/><circle cx="10" cy="16" r="2.2"/>',
  folder: '<path d="M3.5 7.2A1.7 1.7 0 0 1 5.2 5.5h3.3l1.8 2.2h8.5a1.7 1.7 0 0 1 1.7 1.7v8.4a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7Z"/>',
  close: '<path d="m6.5 6.5 11 11m0-11-11 11"/>',
  arrowUp: '<path d="M12 19V5m0 0-6 6m6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14m0 0 6-6m-6 6-6-6"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11.2v5"/><path d="M12 7.6v.5"/>',
  external: '<path d="M14 5h5v5M19 5l-8 8M17 14v4.5A1.5 1.5 0 0 1 15.5 20h-10A1.5 1.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7H10"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName, size = 18): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'icon');
  svg.innerHTML = PATHS[name];
  return svg;
}

