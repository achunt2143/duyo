# {{PROJECT_NAME}}

A [Duyo](https://github.com/achunt2143/duyo) app — classic Enyo 1.x components, built with Vite.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |

## Structure

```
{{PROJECT_NAME}}/
├── index.html        # HTML entry point
├── vite.config.js    # Duyo/Vite config
└── src/
    └── main.js       # App entry — define your Enyo kinds here
```

## Writing components

Write components exactly as you would in Enyo 1.x:

```js
enyo.kind({
  name: 'MyApp.MyWidget',
  kind: enyo.Control,
  published: {
    label: 'Hello'
  },
  components: [
    { tag: 'span', name: 'labelNode' }
  ],
  create: function() {
    this.inherited(arguments);
    this.labelChanged();
  },
  labelChanged: function() {
    this.$.labelNode.setContent(this.label);
  }
});
```
