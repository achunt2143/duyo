// {{PROJECT_NAME}} — a Duyo app
// Duyo is a modern toolchain wrapper around Enyo 1.x.
// Write your components exactly as you would in classic Enyo.

import '@duyo/runtime';

// -----------------------------------------------------------------
// App shell
// -----------------------------------------------------------------
enyo.kind({
  name: '{{PROJECT_NAME_PASCAL}}.Application',
  kind: enyo.Control,
  style: 'padding: 24px; font-family: sans-serif;',
  components: [
    {
      kind: enyo.Control,
      tag: 'h1',
      style: 'font-size: 2rem; margin-bottom: 8px;',
      content: '{{PROJECT_NAME}}'
    },
    {
      kind: enyo.Control,
      style: 'color: #555;',
      content: 'Your Duyo app is running. Edit src/main.js to get started.'
    },
    {
      name: 'counter',
      kind: enyo.Control,
      style: 'margin-top: 24px;',
      components: [
        {
          kind: enyo.Control,
          name: 'countLabel',
          tag: 'p',
          style: 'font-size: 1.25rem;',
          content: 'Count: 0'
        },
        {
          kind: enyo.Control,
          tag: 'button',
          style: 'margin-top: 8px; padding: 8px 20px; font-size: 1rem; cursor: pointer;',
          content: 'Increment',
          ontap: 'increment'
        }
      ]
    }
  ],

  _count: 0,

  increment: function(inSender, inEvent) {
    this._count++;
    this.$.countLabel.setContent('Count: ' + this._count);
  }
});
