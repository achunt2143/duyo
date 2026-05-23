# Enyo 2.7 Setup

The `framework/` directory is not committed to this repo — you need to vendor
Enyo 2.7 yourself. Once vendored, run the build step to produce `build/enyo.js`,
which is what `@duyo/vite-plugin` serves to the browser.

## 1. Vendor Enyo 2.7 source

From the repo root:

```bash
git clone --depth 1 --branch 2.7.0 https://github.com/enyojs/enyo.git /tmp/enyo-2.7
cp -r /tmp/enyo-2.7/src packages/runtime/framework/src
cp    /tmp/enyo-2.7/index.js packages/runtime/framework/index.js
rm -rf /tmp/enyo-2.7
```

Your `packages/runtime/framework/` should now look like:

```
framework/
├── index.js       ← enyo entry point (chains all require() calls)
└── src/
    ├── Boot.js
    ├── Component.js
    ├── Control.js
    └── ... (all enyo core source files)
```

## 2. Install dependencies

```bash
cd packages/runtime
npm install
```

This installs `rollup` + the CommonJS and node-resolve plugins.

## 3. Build

```bash
npm run build
```

This runs `rollup -c rollup.config.mjs` and outputs:

```
build/
├── enyo.js    ← browser-ready IIFE bundle (Enyo core + Duyo custom kinds)
└── enyo.css   ← concatenated styles from framework/src/ + src/
```

## 4. Start the app

From `apps/example` (or any Duyo app):

```bash
npm run dev
```

The vite-plugin reads `build/enyo.js` and serves it as a classic `<script>`
before your app's module code runs.

## Adding custom components

1. Create `src/MyKind.js` — define your kind with `enyo.kind({ name: 'Duyo.MyKind', ... })`
2. Add `require('./MyKind');` to `src/index.js`
3. Run `npm run build` again (or keep `npm run build:watch` running)

## Rebuilding after changes

Every time you add or edit a file in `src/`, re-run:

```bash
cd packages/runtime && npm run build
```

Or run `npm run build:watch` in a separate terminal during development —
Rollup will automatically rebuild whenever you save a file.
