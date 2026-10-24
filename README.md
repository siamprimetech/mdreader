# Simple MD Reader

Opens and reads markdown files on Linux, Windows, macOS, iOS and Android. One codebase, built
with [Tauri v2](https://tauri.app): a native shell around a small TypeScript front-end.

Opens .md, .markdown, .mdown, .mkd and .mdx files. Searches inside them, lists the headings, and never writes to them.

---

## Getting it

The reader ships as a **self-contained binary**. Nothing has to be installed alongside it — no Node.js, no runtime, no
package manager. You download a file, you run it, you are reading.

| Platform | What you get                | To run it                                                         |
|----------|-----------------------------|-------------------------------------------------------------------|
| Linux    | `.AppImage`, `.deb`, `.rpm` | `./Simple MD Reader_1.0.0_amd64.AppImage`, or install the package |
| Windows  | `.msi`, `-setup.exe`        | Run the installer, or the portable `.exe`                         |
| macOS    | `.dmg`, `.app`              | Drag the app to Applications                                      |
| iOS      | `.ipa`                      | Install through Xcode or TestFlight                               |
| Android  | `.apk`                      | Install the package                                               |

The Linux `.deb` needs only WebKitGTK, which every current desktop already has. The AppImage carries everything with it,
so it runs on any distribution from Alpine to Arch without a package manager.

---

## What it does

**Open documents three ways.** The toolbar button and `Ctrl`+`O` open the native file picker. Dropping a `.md` file
anywhere on the window works too, and pasting markdown from the clipboard is treated as opening a new document. A file
opened from the system — double-clicked in a file manager, or handed to the app from the command line — opens as well.

**Handles markdown files.** Once installed, the reader registers itself for
`.md`, `.markdown`, `.mdown`, `.mkd` and `.mdx` files. It appears in the
"Open with" list, and can be made the default. Whatever the system hands over is opened straight away.

**Remembers what you read.** The clock button in the toolbar opens the history at any time, and the welcome screen lists
it too. In the desktop app documents are remembered by path, so reopening shows the file as it is on disk right now.

**Finds its way around a long document.** The outline panel lists every heading; clicking one scrolls to it and marks
it. `Ctrl`+`F` opens the find bar, with `Enter` and `Shift`+`Enter` stepping through the matches.

**Adjustable to taste.** Every measurement and color on the page is a setting, and every setting applies instantly.

|                |                                                                                                                     |
|----------------|---------------------------------------------------------------------------------------------------------------------|
| **Appearance** | Light, dark, or follow the system. Accent color and paper grain are yours to pick.                                  |
| **Palette**    | Seven ready-made color schemes, each of which sets the accent and the link color together.                          |
| **Links**      | Link color, and whether links are always underlined or only on hover.                                               |
| **Typography** | Body face, code face, size, line height, letter spacing, word spacing, paragraph spacing, heading scale, alignment. |
| **Layout**     | Column width and image corners.                                                                                     |
| **Code**       | Code size.                                                                                                          |

A palette is only a starting point: the accent and link color can still be set to any color afterwards, and the palette
swatch empties when you do. **Reads well in either light.** Two palettes: a warm printed *paper* for daylight, and a
deep *ink* for night. Switching wipes across the page from wherever you clicked, so the change reads as deliberate.

**Opens quickly.** The reader is a viewer, not an editor, and it is built for one: the syntax highlighter is only
fetched when a document actually contains code, the settings drawer is only built when it is opened, and the document is
read in a single call to the backend rather than two. The whole window is up and painting in about a tenth of a second.

It also arrives in the right color. The palette follows the system from the first paint, and the window is given the
same color before the page loads, so the reader never appears as a white rectangle while it starts.

**Tells you when it is out of date.** The button at the end of the toolbar opens the about window, which knows the
version you are running and can ask GitHub whether a newer release has been published. If there is one, it offers to
download and install it, and the reader restarts afterwards. Nothing is ever installed without being asked. A sample
document lives in `docs/sample.md`, if you would rather look at something than be told about it.

---

## Keyboard shortcuts

|                    |                                                                  |
|--------------------|------------------------------------------------------------------|
| `Ctrl`+`O`         | Open a file                                                      |
| `Ctrl`+`F`         | Find in the document                                             |
| `Ctrl`+`,`         | Reading settings                                                 |
| `Ctrl`+`B`         | Toggle the outline                                               |
| `Ctrl`+`H`         | Recently opened                                                  |
| `Ctrl`+`Shift`+`D` | Switch between light and dark                                    |
| `Esc`              | Close the find bar, the settings drawer, the outline or the menu |

On macOS, `Cmd` works in place of `Ctrl`.

---

## Building it

Building needs Node.js and Rust. *Running* needs neither.

- [Node.js](https://nodejs.org) 20 or newer
- [Rust](https://rustup.rs) 1.77 or newer (`rustup` handles this)
- The platform packages of the system you build on — [Tauri lists them per system](https://v2.tauri.app/start/prerequisites/)

```bash
npm install
npm run tauri:dev      # run it while you work on it
npm run check          # type checks, the tests, and a production build
npm run tauri:build    # a packaged application for this platform
```

On Debian or Ubuntu the packages the build links against are:

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

`npm run dev` starts the front-end alone in a browser at `localhost:1420`, which is handy for working on the interface
without rebuilding Rust. The tests run on Node's own test runner and need no test framework.

The release process, the continuous integration and the notes on how the code is put together are kept with the
maintainers.

---

## Project

The source lives at [github.com/siamprimetech/mdreader](https://github.com/siamprimetech/mdreader). The about window in
the application checks that same address for new releases.

The reader collects nothing: no analytics, no accounts, no data leaving the device. The policy that says so, and that
the app stores link to, is [PRIVACY.md](PRIVACY.md). It is published by GitHub Pages, from [`site/`](site/), which also
carries the project's website, so the store listings can point at
`https://siamprimetech.github.io/mdreader/privacy.html`.

---

## License

MIT — see [LICENSE.md](LICENSE.md).

The reader bundles eight typefaces and links a good many Rust and JavaScript libraries, each under its own license. They
are all listed, with the full text of every license that applies, in
[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md). That file is generated from the package manifests by
`tools/collect-licenses.py`; run it after changing a dependency.

To report a vulnerability, see [SECURITY.md](SECURITY.md).
