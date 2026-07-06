# App icons

`icon.svg` is the source of truth (two-stroke N glyph, `#4785FF`, transparent
background — must match the design tokens in `src/app.css`). All PNGs are
rendered from it; regenerate ALL of them whenever the SVG changes, e.g. with
sharp in a scratch script:

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

(`rsvg-convert` works too.) `icon-192.png` and `icon-512.png` should stay
transparent like the source SVG. `icon-maskable-512.png` and
`apple-touch-icon.png` must stay fully opaque (render with a `#000000`
background, e.g. `rsvg-convert -b '#000000'`) — maskable icons are cropped
by an OS-applied shape mask that can composite transparent pixels
unpredictably, and Apple's HIG disallows alpha in touch icons.

When colors change, also sync:

- `public/manifest.webmanifest` → `background_color` / `theme_color`
- `index.html` → `<meta name="theme-color">` and the inline splash colors
- nodex-talk's launcher icons: regenerate a 1024px master the same way and
  re-run `flutter_launcher_icons` there (asset: `assets/icon/icon-1024.png`)
