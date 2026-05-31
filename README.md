# xhmy.github.io

Personal academic homepage of **Yifan Zeng** (曾一凡) — PhD student in AI at Oregon State University.

Live at <https://xhmy.github.io>.

## Editing

- **Bio / page content:** `index.md`
- **Publications:** `publications.md` — one block per paper. The homepage parses this file
  in the browser (`assets/js/publications.js`) and renders the year-grouped timeline, so
  adding a paper means editing markdown, not HTML.
- **Contact links / CV:** `_includes/side-info.html`
- **Styling:** `assets/css/style.scss`, layered on top of the `jekyll-theme-minimal` base in `_sass/`.

## Local preview

```sh
bundle install
bundle exec jekyll serve --watch   # http://127.0.0.1:4000/
```

Built with [Jekyll](https://jekyllrb.com/) on GitHub Pages, based on the
[Minimal](https://github.com/pages-themes/minimal) theme (see `LICENSE`).
