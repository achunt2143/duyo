import { view } from '@duyo/core';

import spec from './Buttons.view.json';
import type { CodeBehind } from './Buttons.view.gen.js';

/**
 * Behaviour for Buttons.view.json. The spec owns the layout and names these handlers;
 * the generated CodeBehind type makes sure every one exists and that `this.$` matches the
 * components the spec names.
 */
export default view(spec, {
  tapped(sender) {
    this.log(`ontap: ${sender.content}`);
  },

  viewSelected(_sender, event) {
    this.log(`onSelect: ${JSON.stringify(event['value'])} (index ${event['index']})`);
  },

  switched(sender, event) {
    this.log(`onChange: ${sender.name} = ${JSON.stringify(event['value'])}`);
  },

  flipFromCode() {
    this.$.wifi.setValue(!this.$.wifi.value);
    this.$.agree.setChecked(!this.$.agree.checked);
    this.log(`set from code: wifi = ${this.$.wifi.value}, agree = ${this.$.agree.checked}`);
  },

  sized(sender) {
    for (const radio of [this.$.small, this.$.medium, this.$.large]) {
      if (radio !== sender) radio.setChecked(false);
    }
    this.log(`onChange: size = ${sender.value}`);
  },
} satisfies CodeBehind);
