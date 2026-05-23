/**
 * Duyo Example App
 *
 * A smoke-test app for @duyo/runtime + @duyo/vite-plugin.
 * Shows off kind inheritance, published properties, components tree,
 * and event handling — all pure Enyo 1.x idioms.
 */

import enyo from '@duyo/runtime';

// -----------------------------------------------------------------
// A reusable counter widget
// -----------------------------------------------------------------
enyo.kind({
  name: 'Example.Counter',
  kind: enyo.Control,
  published: {
    label: 'Counter',
    step: 1
  },
  events: {
    onChange: ''
  },
  style: [
    'display: inline-flex;',
    'align-items: center;',
    'gap: 12px;',
    'padding: 12px 16px;',
    'background: #f3f0ec;',
    'border-radius: 8px;',
    'font-family: sans-serif;'
  ].join(' '),
  components: [
    { tag: 'span', name: 'labelNode', style: 'font-weight: 600;' },
    {
      tag: 'button',
      name: 'decBtn',
      content: '−',
      style: 'width:32px;height:32px;font-size:1.2rem;cursor:pointer;border:1px solid #ccc;border-radius:4px;background:#fff;',
      ontap: 'decrement'
    },
    { tag: 'span', name: 'countNode', style: 'min-width: 2ch; text-align: center; font-size: 1.1rem;' },
    {
      tag: 'button',
      name: 'incBtn',
      content: '+',
      style: 'width:32px;height:32px;font-size:1.2rem;cursor:pointer;border:1px solid #ccc;border-radius:4px;background:#fff;',
      ontap: 'increment'
    }
  ],

  _value: 0,

  create: function () {
    this.inherited(arguments);
    this.labelChanged();
  },

  rendered: function () {
    this.inherited(arguments);
    this._update();
  },

  labelChanged: function () {
    this.$.labelNode.setContent(this.label);
  },

  increment: function () {
    this._value += this.step;
    this._update();
    this.doChange({ value: this._value });
  },

  decrement: function () {
    this._value -= this.step;
    this._update();
    this.doChange({ value: this._value });
  },

  _update: function () {
    this.$.countNode.setContent(String(this._value));
  }
});

enyo.kind({
  name: 'Example.Application',
  kind: enyo.Control,
  style: 'padding: 32px; font-family: sans-serif; max-width: 600px; margin: 0 auto;',
  components: [
    {
      tag: 'h1',
      style: 'font-size: 1.8rem; margin-bottom: 4px;',
      content: 'Duyo Example App'
    },
    {
      tag: 'p',
      style: 'color: #666; margin-bottom: 32px;',
      content: 'Smoke-testing @duyo/runtime + @duyo/vite-plugin'
    },
    {
      tag: 'h2',
      style: 'font-size: 1rem; text-transform: uppercase; letter-spacing: 0.05em; color: #999; margin-bottom: 12px;',
      content: 'Counter widget'
    },
    {
      kind: 'Example.Counter',
      name: 'myCounter',
      label: 'Score',
      step: 1,
      onChange: 'onCounterChange'
    },
    {
      kind: 'Example.Counter',
      name: 'bigCounter',
      label: 'By 5s',
      step: 5,
      style: 'margin-top: 12px;',
      onChange: 'onCounterChange'
    },
    {
      tag: 'p',
      name: 'log',
      style: 'margin-top: 24px; color: #888; font-size: 0.9rem;',
      content: 'Tap the buttons above.'
    }
  ],

  onCounterChange: function (inSender, inEvent) {
    var msg = inSender.label + ' changed to ' + inEvent.value;
    this.$.log.setContent('Last change: ' + msg);
  }
});