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
 *    tellurium_config.json from the webOS filesystem.
 *
 * 3. Patch enyo.kind.inherited for strict-mode / ES-module compatibility.
 *    ES modules are always strict; strict mode forbids arguments.callee.
 *
 *    Strategy (minimal, surgical — does NOT rebuild enyo.kind.features):
 *      a) Find the 'inherited' feature hook already in enyo.kind.features
 *         (identified by its source containing '_inherited' and 'nom') and
 *         replace it in-place with a version that also stamps fn._self = fn
 *         on every method it decorates.
 *      b) Replace enyo.kind.inherited with a callee-free version that reads
 *         _inherited from args[0]._self instead of args.callee.
 *      c) Back-fill _self onto all already-defined built-in kind methods so
 *         framework classes work too.
 *
 *    All other features (statics, mixins) are completely untouched.
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
    Tellurium.config = { enableUserEvents: true };
    Tellurium.stageType = 'card';
    window.addEventListener('unload', Tellurium.cleanup, false);
    window.addEventListener('resize', Tellurium.handleResize, false);
  };
}

// @duyo/vite-plugin — patch inherited() for strict-mode / ES module compatibility
(function patchInherited() {
  if (!globalThis.enyo || !globalThis.enyo.kind) return;
  var enyo = globalThis.enyo;
  var features = enyo.kind.features;

  // Step 1: Find and replace the 'inherited' feature hook in-place.
  // It's identified by stamping _inherited and nom onto methods.
  // We replace it with a version that also stamps _self = fn so
  // enyo.kind.inherited can reach _inherited without args.callee.
  for (var i = 0; i < features.length; i++) {
    var src = features[i].toString();
    if (src.indexOf('_inherited') !== -1 && src.indexOf('nom') !== -1) {
      var origFeature = features[i];
      features[i] = function(ctor, props) {
        // Run the original feature — stamps _inherited and nom as before
        origFeature(ctor, props);
        // Additionally stamp _self on every method that got _inherited
        if (ctor.prototype.base) {
          for (var n in props) {
            var p = props[n];
            if (typeof p === 'function' && p._inherited) {
              p._self = p;
            }
          }
        }
      };
      break;
    }
  }

  // Step 2: Replace enyo.kind.inherited with a callee-free version.
  // Original: return args.callee._inherited.apply(this, newArgs || args)
  // New: read _inherited from args[0]._self (stamped in step 1 & 3).
  // args[0] is the raw 'arguments' object passed by the caller, so
  // args[0] is the first argument — but inherited() receives the whole
  // arguments object as its first param. We need the _self on that
  // arguments object's callee equivalent, which is args._self if we
  // stamp it on the arguments object itself — but we can't do that.
  //
  // Better: stamp _self on the function itself (done in step 1), then
  // wrap the method at call time so 'this.inherited' is a closure that
  // already knows which _inherited to call. We do this via a one-time
  // replacement of enyo.kind.inherited that wraps each proto method the
  // first time it's encountered via a lazy-wrap on enyo.kind.
  //
  // Simplest correct approach: patch enyo.kind() itself to post-process
  // each new kind's methods through _makeWrapper after features run.
  var _origKind = enyo.kind;
  enyo.kind = function(inProps) {
    var ctor = _origKind(inProps);
    var proto = ctor.prototype;
    // Wrap any method that has _inherited but hasn't been wrapped yet
    for (var n in proto) {
      if (proto.hasOwnProperty(n)) {
        var fn = proto[n];
        if (typeof fn === 'function' && fn._inherited && !fn.__strictWrapped) {
          proto[n] = _makeWrapper(fn);
        }
      }
    }
    return ctor;
  };
  // Copy all static properties from the original enyo.kind onto the new one
  for (var k in _origKind) {
    if (_origKind.hasOwnProperty(k)) {
      enyo.kind[k] = _origKind[k];
    }
  }

  // _makeWrapper: wraps fn so that when called, this.inherited is temporarily
  // a function that calls fn._inherited — no args.callee needed.
  function _makeWrapper(fn) {
    var inheritedFn = fn._inherited;
    var wrapper = function() {
      var prev = this.inherited;
      this.inherited = function(args, newArgs) {
        return inheritedFn.apply(this, newArgs || args);
      };
      try {
        return fn.apply(this, arguments);
      } finally {
        this.inherited = prev;
      }
    };
    wrapper._inherited = fn._inherited;
    wrapper._self = wrapper;
    wrapper.nom = fn.nom;
    wrapper.__strictWrapped = true;
    return wrapper;
  }

  // Step 3: Back-fill all already-defined built-in Enyo kind prototypes.
  for (var key in enyo) {
    var val = enyo[key];
    if (typeof val === 'function' && val.prototype && val.prototype.kindName) {
      var proto = val.prototype;
      for (var n in proto) {
        if (proto.hasOwnProperty(n)) {
          var fn = proto[n];
          if (typeof fn === 'function' && fn._inherited && !fn.__strictWrapped) {
            proto[n] = _makeWrapper(fn);
          }
        }
      }
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
  /var b = Tellurium\.enyo\.xhr\.request\(\{[\s\S]*?\}\)\.responseText \|\| "\{\}";[\s]*Tellurium\.config = Tellurium\.extend\(Tellurium\.config, enyo\.json\.parse\(b\)\)/,
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
