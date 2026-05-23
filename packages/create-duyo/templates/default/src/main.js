// {{PROJECT_NAME}} — a Duyo app
// Duyo is a modern toolchain wrapper around Enyo 2.7.
// Write your components exactly as you would in classic Enyo.
//
// Mounting is handled automatically by @duyo/vite-plugin via the
// `appKind` option in vite.config.js — no manual renderInto() needed.

import enyo from '@duyo/runtime';

// -----------------------------------------------------------------
// App shell
// -----------------------------------------------------------------
enyo.kind({
  name: '{{PROJECT_NAME_PASCAL}}.Application',
  kind: enyo.Control,
  style: 'padding: 24px; font-family: sans-serif;',
  components: [
    {
      tag: 'h1',
      style: 'font-size: 2rem; margin-bottom: 8px;',
      content: '{{PROJECT_NAME}}'
    },
    {
      tag: 'p',
      style: 'color: #555;',
      content: 'Your Duyo app is running. Edit src/main.js to get started.'
    },
    {
      name: 'counter',
      components: [
        {
          tag: 'p',
          name: 'countLabel',
          style: 'font-size: 1.25rem; margin-top: 24px;',
          content: 'Count: 0'
        },
        {
          tag: 'button',
          style: 'margin-top: 8px; padding: 8px 20px; font-size: 1rem; cursor: pointer;',
          content: 'Increment',
          ontap: 'increment'
        }
      ]
    }
  ],

  _count: 0,

  increment: function () {
    this._count++;
    this.$.countLabel.setContent('Count: ' + this._count);
  }
});
