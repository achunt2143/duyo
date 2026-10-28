# create-duyo

> **Archived.** Part of the first Duyo iteration (vendored Enyo 2.7). It is being replaced by a TypeScript runtime and kind packs; see the root [README](../../README.md) and the `archive/enyo-2.7-runtime` tag.

Scaffold a new [Duyo](https://github.com/achunt2143/duyo) app in one command.

```bash
npm create duyo@latest my-app
# or
npx create-duyo my-app
```

Then:

```bash
cd my-app
npm install
npm run dev
```

## What you get

```
my-app/
├── index.html        # HTML shell with <div id="root">
├── vite.config.js    # Duyo plugin wired up, appKind configured
├── .gitignore
└── src/
    └── main.js       # Working Enyo 2.7 counter app to start from
```

The generated app includes a working counter example that demonstrates `enyo.kind`, `components`, `published` properties, and event handling — the four pillars of Enyo component authoring.

## License

Apache 2.0
