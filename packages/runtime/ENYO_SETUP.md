# Vendoring Enyo 2.7 Source

The `framework/` directory is where the enyo 2.7 source lives.
It is **not committed to this repo** — run the commands below once after
cloning to pull it in from the upstream enyojs/enyo repo.

## One-time setup

```bash
# From the repo root:
git clone --depth 1 https://github.com/enyojs/enyo.git /tmp/enyo-2.7
cp -r /tmp/enyo-2.7/src packages/runtime/framework/src
cp /tmp/enyo-2.7/index.js packages/runtime/framework/index.js
cp /tmp/enyo-2.7/package.json packages/runtime/framework/upstream-package.json
rm -rf /tmp/enyo-2.7
```

After running those commands the layout should look like:

```
packages/runtime/framework/
  src/           ← enyo 2.7 source files (Component.js, Control.js, etc.)
  index.js       ← enyo 2.7 main entry (sets window.enyo)
  upstream-package.json
```

The `framework/src` directory is listed in `.gitignore` so it will never
be accidentally committed. Re-run the setup commands any time you want to
pull in upstream fixes from enyojs/enyo.

## Why vendor instead of npm install?

enyo 2.7 was never published to npm. The enyojs/enyo repo is effectively
archived and has no package exports — it relies on its own webOS build
tooling. Duyo takes the approach of owning the source directly so we can
patch it, modernise it, and eventually migrate it to proper ESM over time.
