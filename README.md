# lohitkrishnan.com

The source of [lohitkrishnan.com](https://lohitkrishnan.com): Lohit Krishnan's personal site,
with essays and links to two browser tools. It is a plain static site (HTML, CSS and a little
JavaScript, no build step) served by GitHub Pages from this repository.

## What's here

| Path | What it is |
| --- | --- |
| `index.html` | The home page: writing and tools |
| `essays/<slug>/index.html` | One folder per essay |
| `audio/<slug>.mp3`, `audio/<slug>.json` | Narration for each essay and its word-by-word timings |
| `js/listen.js` | The **Listen** button: plays the narration and highlights each word as it is read |
| `js/songs.js` | Loads a YouTube player only when someone presses play on a song |
| `css/site.css` | All styles, with light and dark themes |
| `img/` | Share-preview cards (1200 × 630) and song thumbnails |
| `fonts/` | Lora, the site's typeface |
| `CNAME` | Points GitHub Pages at the lohitkrishnan.com domain |
| `robots.txt` | Lets search engines index everything |

The tools are separate repositories, published under this domain by GitHub Pages:

- [PDF Studio](https://lohitkrishnan.com/pdf/) ([source](https://github.com/lohitkrishnan/pdf)):
  lock, unlock, compress, merge, fill, sign, edit and redact PDFs in the browser.
- [Image Studio](https://lohitkrishnan.com/image/) ([source](https://github.com/lohitkrishnan/image)):
  resize, passport photos, PDFs, GIFs and annotation in the browser.

Both work entirely on the visitor's device; files are never uploaded.

## Narration

Each essay can be read aloud by an AI voice from [ElevenLabs](https://elevenlabs.io). The
`.json` file next to the recording holds one start/end time per word on the page, which is how
`listen.js` highlights along. It checks that the number of timings matches the number of words
and, if they differ, plays the audio without highlighting. So:

- **Editing an essay's text** after recording means re-recording, or the highlighting turns off.
- **Adding a note that isn't in the recording** (like the AI co-drafting note) needs
  `data-listen-skip` on its paragraph, so it isn't counted.

## Adding an essay

1. Copy an existing `essays/<slug>/` folder and write the new essay.
2. Update its `<title>`, description, `og:` tags and canonical URL.
3. Make a share card at `img/card-<slug>.png` (1200 × 630) in the same style as the others.
4. Add it to the list at the top of the Writing section in `index.html`.
5. Optionally record narration into `audio/<slug>.mp3` with matching `audio/<slug>.json`.

When changing `site.css` or a script, bump its `?v=` number in the pages that load it so
returning visitors don't get a stale copy.

## Running locally

```sh
python3 -m http.server 8000
# open http://localhost:8000/
```

## Privacy

Page views are counted with [GoatCounter](https://www.goatcounter.com), a privacy-friendly
counter that doesn't use cookies.

## Licence

The site's **code** (HTML, CSS and JavaScript) is under the [MIT License](LICENSE).

The **essays, narration audio and images** are not: they are © 2026 Lohit Krishnan, all rights
reserved. Please ask before reusing them. The Lora font is under the SIL Open Font License
(`fonts/Lora-LICENSE.txt`).
