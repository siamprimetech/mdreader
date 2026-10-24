/**
 * The application mark: a sheet of paper carrying a proofreader's underline.
 */

export function logo(size = 28): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'logo');
  svg.innerHTML = `
    <rect x="5.5" y="3.5" width="21" height="25" rx="3" class="logo__page" />
    <path d="M10 10h12M10 15h12M10 20h7" class="logo__rule" />
    <path d="M9.5 23.6c3.2 1.6 9.4 1.5 13-.4" class="logo__mark" />
  `;
  return svg;
}
