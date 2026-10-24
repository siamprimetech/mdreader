# The Reader's Manual

A small tour of everything **Simple MD Reader** can do. Every control in this document is live — try them.

## Opening documents

There are three ways in, and they all end up in the same place:

- Press **Open a file** in the toolbar or hit `Ctrl` + `O`.
- Drop a `.md` file anywhere on the window.
- Copy some markdown and press `Ctrl` + `V`.

> Files are read straight from disk. Reopening a recent file shows you the file
> as it is *now*, not as it was when you last read it.

## Reading

The outline on the left lists every heading in the document. Click one to jump to it. `Ctrl` + `F` opens the find bar,
where `Enter` and `Shift` + `Enter`
step through the matches.

### The history

The clock in the toolbar opens the list of documents you have read lately, so you can go back to one without hunting
through your folders. The same list sits on the welcome screen when nothing is open.

### Typography

Everything about the type is adjustable under **Reading** in the settings panel, which opens with `Ctrl` + `,`.

| Control      | What it does                    |
|--------------|---------------------------------|
| Body face    | The typeface the page is set in |
| Size         | How large the text is           |
| Line height  | How much air sits between lines |
| Column width | How wide the page runs          |
| Link color   | The color of links              |

### Code

Fenced code blocks are highlighted, and the code face can be set separately from the body face.

```ts
type ReaderSettings = {
    theme: 'light' | 'dark' | 'system';
    fontSize: number;
    lineHeight: number;
};
```

```python
def reading_time(words: int, wpm: int = 220) -> int:
    return max(1, round(words / wpm))
```

### Lists and quotes

- Reading is adjustable
- Every change applies instantly
- Nothing is hidden behind a menu

> Typography is the voice of a document. The reader lets you find the voice
> that suits you.

1. Open the settings panel
2. Change the body face
3. Watch the page change

## Themes

The reader ships with a warm **paper** theme for daylight and a deep **ink**
theme for night, and can follow whatever your system is doing. The toolbar button switches between the two; the wipe
that crosses the screen shows the change happening where you clicked.

---

That is the whole reader. Open your own markdown and it will look like this.
