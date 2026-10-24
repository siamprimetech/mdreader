/*
 * The theme switch.
 *
 * The theme is a color scheme, so the palettes follow it without a second
 * copy of every color. The switch wipes from the button that was pressed,
 * the same way the reader does it.
 */
(function () {
  var root = document.documentElement;
  var THEME_KEY = 'md-reader.theme';

  function store(value) {
    try {
      localStorage.setItem(THEME_KEY, value);
    } catch (error) {
      /* A browser that refuses local storage still gets a page. */
    }
  }

  function resolved(theme) {
    if (theme === 'light' || theme === 'dark') return theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function syncThemeColor(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.content = theme === 'dark' ? '#14161b' : '#f4efe6';
  }

  function apply(theme) {
    root.dataset.theme = theme;
    syncThemeColor(resolved(theme));
  }

  function wipe(theme, x, y) {
    var next = resolved(theme);
    var current = resolved(root.dataset.theme || 'system');

    if (next === current) {
      apply(theme);
      return;
    }

    var overlay = document.createElement('div');
    overlay.className = 'wipe';
    overlay.dataset.theme = next;
    overlay.style.setProperty('--wipe-x', x + 'px');
    overlay.style.setProperty('--wipe-y', y + 'px');
    overlay.style.setProperty(
      '--wipe-radius',
      Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 'px'
    );
    document.body.appendChild(overlay);

    var done = false;
    function finish() {
      if (done) return;
      done = true;
      apply(theme);
      overlay.remove();
    }

    requestAnimationFrame(function () {
      overlay.dataset.open = 'true';
    });
    overlay.addEventListener('transitionend', finish, { once: true });
    window.setTimeout(finish, 700);
  }

  function mark(theme) {
    var buttons = document.querySelectorAll('[data-theme-choice]');
    for (var i = 0; i < buttons.length; i += 1) {
      buttons[i].setAttribute('aria-pressed', String(buttons[i].dataset.themeChoice === theme));
    }
  }

  var buttons = document.querySelectorAll('[data-theme-choice]');
  for (var i = 0; i < buttons.length; i += 1) {
    (function (button) {
      button.addEventListener('click', function (event) {
        var theme = button.dataset.themeChoice;
        var box = button.getBoundingClientRect();
        wipe(
          theme,
          event.clientX || box.left + box.width / 2,
          event.clientY || box.top + box.height / 2
        );
        mark(theme);
        store(theme);
      });
    })(buttons[i]);
  }

  /* The reader's own shortcut: control and shift and D. */
  document.addEventListener('keydown', function (event) {
    if (!(event.ctrlKey || event.metaKey) || event.shiftKey !== true) return;
    if (event.key.toLowerCase() !== 'd') return;
    event.preventDefault();
    var theme = resolved(root.dataset.theme || 'system') === 'dark' ? 'light' : 'dark';
    wipe(theme, window.innerWidth / 2, window.innerHeight / 2);
    mark(theme);
    store(theme);
  });

  var saved = root.dataset.theme || 'system';
  mark(saved);
  syncThemeColor(resolved(saved));
})();

/*
 * The menu.
 *
 * On a narrow screen the links fold away behind a burger; on a wide one they
 * sit in the bar. The button only exists on the narrow side, so the menu is
 * closed again whenever the layout changes underneath it.
 */
(function () {
  var button = document.querySelector('[data-menu-toggle]');
  var menu = document.getElementById('site-nav');
  if (!button || !menu) return;

  function setOpen(open) {
    menu.setAttribute('data-open', String(open));
    button.setAttribute('aria-expanded', String(open));
  }

  button.addEventListener('click', function () {
    setOpen(button.getAttribute('aria-expanded') !== 'true');
  });

  menu.addEventListener('click', function (event) {
    if (event.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') setOpen(false);
  });

  var wide = window.matchMedia('(min-width: 60.0625rem)');
  var onChange = function (event) {
    if (event.matches) setOpen(false);
  };
  if (typeof wide.addEventListener === 'function') {
    wide.addEventListener('change', onChange);
  } else {
    wide.addListener(onChange);
  }
})();
