/**
 * @duyo/vite-plugin
 *
 * Teaches Vite how to build and serve Duyo (Enyo 1.x) applications.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RUNTIME_ROOT = resolve(__dirname, '../../runtime');
const ENYO_BUILD_JS = resolve(RUNTIME_ROOT, 'framework/build/enyo-build.js');
const ENYO_BUILD_CSS = resolve(RUNTIME_ROOT, 'framework/build/enyo-build.css');

const VIRTUAL_APP_ID = 'virtual:duyo-app';
const RESOLVED_VIRTUAL_APP_ID = '\0' + VIRTUAL_APP_ID;
const VIRTUAL_RUNTIME_ID = 'virtual:duyo-runtime';
const RESOLVED_VIRTUAL_RUNTIME_ID = '\0' + VIRTUAL_RUNTIME_ID;

const BROWSER_PREAMBLE = `
// @duyo/vite-plugin — browser-safe Enyo bootstrap
var __duyoGlobal = globalThis;
__duyoGlobal.enyo = __duyoGlobal.enyo || {};
__duyoGlobal.enyo.isBuiltin = false;
__duyoGlobal.enyo.args = __duyoGlobal.enyo.args || {};
__duyoGlobal.enyo.enyoPath = __duyoGlobal.enyo.enyoPath || '';
__duyoGlobal.enyo.depends = __duyoGlobal.enyo.depends || function() {};
__duyoGlobal.enyo.setPrototype = __duyoGlobal.enyo.setPrototype || function(ctor, proto) { ctor.prototype = proto; };

// old Enyo code expects both a free variable and window.enyo
if (typeof window !== 'undefined') {
  window.enyo = __duyoGlobal.enyo;
}

var enyo = __duyoGlobal.enyo;
`;

const PALM_STUB = `
// @duyo/vite-plugin — Palm/webOS stubs for browser environment
if (typeof palmGetResource === 'undefined') {
  window.palmGetResource = function() { return undefined; };
}
if (typeof PalmSystem === 'undefined') {
  window.PalmSystem = {
    deviceInfo: '{}',
    locale: 'en_us',
    localeRegion: 'us',
    phoneRegion: 'us',
    timeFormat: 'HH12',
    timeZone: 'America/New_York',
    useSimulatedMouseClicks: function() {},
    simulateMouseClick: function() {},
    paste: function() {},
    runTextIndexer: function(t) { return t; },
    setWindowOrientation: function() {},
    stageReady: function() {},
    getIdentifier: function() { return ''; },
    activate: function() {},
    deactivate: function() {},
    addBannerMessage: function() {},
    removeBannerMessage: function() {},
    clearBannerMessages: function() {},
    playSoundNotification: function() {},
    launchApplication: function() {},
    getResource: function() { return ''; }
  };
}
if (typeof Mojo === 'undefined') {
  window.Mojo = {};
}
`;

/**
 * Post-build overrides:
 *
 * 1. Force enyo.g11n to "browser" platform so webOS-only g11n code paths
 *    (palmGetResource, MojoLoader, etc.) are never entered.
 *
 * 2. Stub Tellurium.setup to skip the synchronous XHR fetch of
 *    tellurium_config.json from the webOS filesystem. Tellurium is Palm's
 *    automated testing framework and is not needed in a browser build.
 *    We hardcode the single config value (enableUserEvents: true) and
 *    preserve the rest of the setup logic so the object is still safe
 *    to reference if any app code checks for it.
 *
 * 3. Patch enyo.kind.inherited for strict-mode / ES-module compatibility.
 *    ES modules are always strict, and strict mode forbids arguments.callee.
 *    Enyo's inherited() uses args.callee to reach the _inherited pointer
 *    that was stamped onto each overriding method at kind-definition time.
 *
 *    Strategy:
 *      a) Replace enyo.kind.inherited with a version that reads _inherited
 *         from a _self back-reference instead of args.callee.
 *      b) Wrap the existing 'inherited' kind feature so every new method
 *         decorated with _inherited also gets a _self = fn self-reference.
 *      c) Back-fill _self onto all already-defined kind methods (built-in
 *         Enyo kinds) so inherited() works on framework classes too.
 */
const POST_BUILD = `
// @duyo/vite-plugin — force g11n to browser platform
if (globalThis.enyo && globalThis.enyo.g11n) {
  globalThis.enyo.g11n._platform = 'browser';
  globalThis.enyo.g11n._enyoAvailable = true;
  globalThis.enyo.g11n._initialized = true;
}

// @duyo/vite-plugin — stub Tellurium for browser (skip webOS XHR config load)
if (typeof Tellurium !== 'undefined' && Tellurium.setup) {
  Tellurium.setup = function(a) {
    window.Tellurium = Tellurium;
    Tellurium.enyo = a;
    Tellurium.extend = Tellurium.enyo.mixin;
    Tellurium.isActive = false;
    Tellurium.topSceneName = '';
    Tellurium.metaDown = false;
    Tellurium.inVerifyDialog = false;
    Tellurium.delayedEvents = [];
    Tellurium.serviceAvailable = false;
    // Hardcode the config — skips the sync XHR to $palm-tellurium/tellurium_config.json
    Tellurium.config = { enableUserEvents: true };
    Tellurium.stageType = 'card';
    window.addEventListener('unload', Tellurium.cleanup, false);
    window.addEventListener('resize', Tellurium.handleResize, false);
    // enableUserEvents intentionally not wired up — Tellurium events are webOS-only
  };
}

// @duyo/vite-plugin — patch inherited() for strict-mode / ES module compatibility
//
// The original: enyo.kind.inherited = function(args, newArgs) {
//   return args.callee._inherited.apply(this, newArgs || args);
// };
//
// args.callee is forbidden in strict mode (TypeError at runtime).
// Instead, each decorated method gets a _self back-reference stamped
// onto it, so inherited() can reach _inherited without callee.
(function patchInherited() {
  if (!globalThis.enyo || !globalThis.enyo.kind) return;
  var enyo = globalThis.enyo;

  // 1. Replace the inherited() implementation.
  //    _self is stamped by step 2 (future kinds) and step 3 (built-in kinds).
  //    User app code calls: this.inherited(arguments)
  //    We read _self off arguments[0].callee only if strict mode hasn't
  //    already thrown — but we never reach here via callee; instead we
  //    use a wrapper (step 2) that closes over the original fn reference.
  //
  //    The wrapper replaces each method on the prototype with a thin
  //    closure that temporarily installs a per-call inherited() bound to
  //    the correct _inherited pointer, then restores the global one.
  //    This is the same approach used by enyo.kind._wrapFn for mixins.

  // 2. Patch the 'inherited' feature hook so new enyo.kind() calls wrap
  //    each overriding method in a closure that provides strict-safe inherited().
  var _origFeatures = enyo.kind.features.slice();
  enyo.kind.features = [];

  for (var fi = 0; fi < _origFeatures.length; fi++) {
    (function(origFn) {
      enyo.kind.features.push(function(ctor, props) {
        // Run the original feature (stamps _inherited, nom, etc.)
        origFn(ctor, props);

        // After the original 'inherited' feature has run, wrap any method
        // that received an _inherited pointer so it works in strict mode.
        if (origFn === _origInheritedFeature) {
          var proto = ctor.prototype;
          for (var n in props) {
            var p = proto[n];
            if (typeof p === 'function' && p._inherited) {
              proto[n] = _makeInheritedWrapper(p, p._inherited);
            }
          }
        }
      });
    })(_origFeatures[fi]);
  }

  // Capture a reference to the original 'inherited' feature function so
  // we can identify it in the loop above. The inherited feature is the
  // first one pushed in Oop.js — it's the one that stamps _inherited and nom.
  // We identify it by the presence of the _inherited assignment in its source.
  var _origInheritedFeature = null;
  for (var fi2 = 0; fi2 < _origFeatures.length; fi2++) {
    var src = _origFeatures[fi2].toString();
    if (src.indexOf('_inherited') !== -1 && src.indexOf('nom') !== -1) {
      _origInheritedFeature = _origFeatures[fi2];
      break;
    }
  }

  // Rebuild features with the correct _origInheritedFeature reference now known.
  // (The closure above captured it by reference so it's already correct.)

  // _makeInheritedWrapper: returns a new function that, when called, temporarily
  // overrides this.inherited with a version bound to the specific _inherited
  // pointer for this method, so this.inherited(arguments) works in strict mode.
  function _makeInheritedWrapper(fn, inheritedFn) {
    var wrapper = function() {
      var prevInherited = this.inherited;
      this.inherited = function(args, newArgs) {
        return inheritedFn.apply(this, newArgs || args);
      };
      try {
        return fn.apply(this, arguments);
      } finally {
        this.inherited = prevInherited;
      }
    };
    // Preserve metadata that Enyo uses
    wrapper._inherited = fn._inherited;
    wrapper._self = wrapper;
    wrapper.nom = fn.nom;
    return wrapper;
  }

  // 3. Back-fill: walk every already-registered kind (built-in Enyo kinds
  //    that were defined before this patch ran) and wrap their methods.
  enyo.kind.features.push(function() {});
  var kindCtorMap = enyo._kindCtors || {};
  var visited = {};
  function backfillProto(proto) {
    if (!proto || visited[proto.kindName]) return;
    visited[proto.kindName] = true;
    for (var n in proto) {
      if (proto.hasOwnProperty(n)) {
        var p = proto[n];
        if (typeof p === 'function' && p._inherited && !p._self) {
          proto[n] = _makeInheritedWrapper(p, p._inherited);
        }
      }
    }
  }
  // Walk the global enyo namespace for registered constructors
  for (var key in enyo) {
    var val = enyo[key];
    if (typeof val === 'function' && val.prototype && val.prototype.kindName) {
      backfillProto(val.prototype);
    }
  }
}());
`;

export function duyo(options = {}) {
  const {
    appKind = null,
    renderTarget = 'root',
    injectCss = true
  } = options;

  return {
    name: 'duyo',
    enforce: 'pre',

    resolveId(id) {
      if (id === VIRTUAL_APP_ID) return RESOLVED_VIRTUAL_APP_ID;
      if (id === VIRTUAL_RUNTIME_ID) return RESOLVED_VIRTUAL_RUNTIME_ID;
      if (id === '@duyo/runtime') return RESOLVED_VIRTUAL_RUNTIME_ID;
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_RUNTIME_ID) {
        let build = readFileSync(ENYO_BUILD_JS, 'utf-8');

        build = build.replace(
  /var b = Tellurium\.enyo\.xhr\.request\(\{[\s\S]*?\}\)\.responseText \|\| "\{\}";\s*Tellurium\.config = Tellurium\.extend\(Tellurium\.config, enyo\.json\.parse\(b\)\)/,
  `Tellurium.config = Tellurium.extend(Tellurium.config, { enableUserEvents: false })`
);

        const wrappedBuild = `
(function() {
  var enyo = globalThis.enyo;
  (0, eval)(${JSON.stringify(build)});
}).call(globalThis);
`;

        return [
          '// @duyo/runtime — Enyo 1.0 pre-built bundle',
          PALM_STUB,
          BROWSER_PREAMBLE,
          '// enyo-build.js (wrapped for real global scope)',
          wrappedBuild,
          '// post-build platform overrides',
          POST_BUILD,
          'export var enyo = globalThis.enyo;',
          'export default globalThis.enyo;'
        ].join('\n');
      }

      if (id === RESOLVED_VIRTUAL_APP_ID) {
        if (!appKind) return `import '@duyo/runtime';\nexport {};`;
        return [
          `import '@duyo/runtime';`,
          `window.addEventListener('load', function() {`,
          `  var target = document.getElementById('${renderTarget}');`,
          `  if (!target) { console.error('[duyo] Render target #${renderTarget} not found.'); return; }`,
          `  try { var app = window.enyo.create({ kind: '${appKind}' }); app.renderInto(target); }`,
          `  catch (e) { console.error('[duyo] Failed to render ${appKind}:', e); }`,
          `});`
        ].join('\n');
      }
    },

    transformIndexHtml(html) {
      if (!injectCss) return html;
      return html.replace(/(<head[^>]*>)/i, '$1\n    <link rel="stylesheet" href="/@duyo/enyo.css">');
    },

    configureServer(server) {
      server.middlewares.use('/@duyo/enyo.css', (req, res) => {
        const css = readFileSync(ENYO_BUILD_CSS, 'utf-8');
        res.setHeader('Content-Type', 'text/css');
        res.end(css);
      });
    }
  };
}

export default duyo;
