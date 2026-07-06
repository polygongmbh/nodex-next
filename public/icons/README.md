# App icons

`icon.svg` is the source of truth (two-stroke N glyph, `#4785FF` on black —
must match the design tokens in `src/app.css`). All PNGs are rendered from
it; regenerate ALL of them whenever the SVG changes, e.g. with sharp in a
scratch script:

```js
const sharp = require("sharp");
for (const [file, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["icon-maskable-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  await sharp("icon.svg", { density: 300 }).resize(size, size).png().toFile(file);
}
```

(`rsvg-convert` works too.) When colors change, also sync:

- `public/manifest.webmanifest` → `background_color` / `theme_color`
- `index.html` → `<meta name="theme-color">` and the inline splash colors
- nodex-talk's launcher icons: regenerate a 1024px master the same way and
  re-run `flutter_launcher_icons` there (asset: `assets/icon/icon-1024.png`)
