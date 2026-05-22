# @duyo/vite-plugin

Vite plugin for building [Duyo](https://github.com/achunt2143/duyo) (Enyo 1.x) applications with modern tooling.

## Install

```bash
npm install --save-dev @duyo/vite-plugin vite
```

## Usage

### Option A — Quick config helper

```js
// vite.config.js
import { createDuyoConfig } from '@duyo/vite-plugin/create-config';

export default createDuyoConfig({
  appKind: 'MyApp.Application',  // Your top-level Enyo kind
  renderTarget: 'root'           // <div id="root"> in your index.html
});
```

### Option B — Manual plugin setup

```js
// vite.config.js
import { defineConfig } from 'vite';
import { duyo } from '@duyo/vite-plugin';

export default defineConfig({
  plugins: [
    duyo({
      appKind: 'MyApp.Application',
      renderTarget: 'root',
      stubPalmSystem: true,  // Stubs window.PalmSystem for non-webOS browsers
      injectCss: true        // Auto-injects enyo-build.css into index.html
    })
  ]
});
```

## App entry point

Your `index.html` just needs a render target:

```html
<!DOCTYPE html>
<html>
  <head><title>My Duyo App</title></head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

Your `src/main.js` imports the runtime and defines your app kinds exactly as Enyo 1.x apps always worked:

```js
import '@duyo/runtime'; // Makes window.enyo available

enyo.kind({
  name: 'MyApp.Application',
  kind: enyo.Control,
  components: [
    { kind: 'enyo.Control', content: 'Hello from Duyo!' }
  ]
});
```

If you set `appKind` in the plugin config, the app is auto-bootstrapped on `window.load`. Otherwise, call `renderInto` yourself:

```js
var app = enyo.create({ kind: 'MyApp.Application' });
app.renderInto(document.getElementById('root'));
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `appKind` | `string` | `null` | Top-level Enyo kind to auto-render |
| `renderTarget` | `string` | `'root'` | ID of the DOM element to render into |
| `stubPalmSystem` | `boolean` | `true` | Inject a `window.PalmSystem` stub for browser environments |
| `injectCss` | `boolean` | `true` | Auto-inject `enyo-build.css` into `index.html` |
| `appRoot` | `string` | `process.cwd()` | Root directory of the app (for future asset resolution) |

## License

Apache 2.0
