import { defaultKindRegistry, view } from '@duyo/core';
import { loadSpec } from '@duyo/views/load';

import type { CodeBehind } from './Loaded.view.gen.js';
import spec from './Loaded.view.json';

/** What a server might send: a screen, as data. */
const GOOD = JSON.stringify(
  {
    name: 'Remote.Profile',
    kind: 'duyo.FittableRows',
    gap: 'sm',
    components: [
      { kind: 'remochi.Header', content: 'Loaded from "the server"' },
      { content: 'None of this was in the app when it was built.' },
      { kind: 'remochi.Button', content: 'Ping the host', variant: 'affirmative', ontap: 'sampler.ping' },
    ],
  },
  null,
  2,
);

/** Reaches for a kind, a handler and a value the host did not allow. */
const HOSTILE = JSON.stringify(
  {
    name: 'Remote.Hostile',
    kind: 'duyo.FittableRows',
    components: [
      { kind: 'Sampler.Section' },
      { kind: 'remochi.Button', content: 'Delete everything', ontap: 'admin.deleteEverything' },
      { kind: 'remochi.Button', content: 'Odd', variant: 'purple' },
    ],
  },
  null,
  2,
);

let loads = 0;

export default view(
  spec,
  {
    create() {
      this.inherited(arguments);
      this.$.source.setValue(GOOD);
    },

    reset() {
      this.$.source.setValue(GOOD);
      this.load();
    },

    hostile() {
      this.$.source.setValue(HOSTILE);
      this.load();
    },

    load() {
      const result = loadSpec(this.$.source.value, {
        registry: defaultKindRegistry,
        allowedKinds: ['duyo.*', 'remochi.*'],
        allowedHandlers: ['sampler.ping'],
      });

      for (const child of [...this.$.stage.children]) child.destroy();

      if (!result.ok || !result.spec) {
        const lines = result.diagnostics.map((d) => `${d.code} at ${d.path}: ${d.message}${d.hint ? ` ${d.hint}` : ''}`);
        this.$.result.setContent(`Refused.\n${lines.join('\n')}`);
        this.log(`loaded spec refused (${result.diagnostics.length} problems)`);
        return;
      }

      // Each load is a new kind, so a name the page already knows never collides.
      const name = `${String(result.spec['name'])}${++loads}`;
      view({ ...result.spec, name } as never, {}, { registry: defaultKindRegistry });
      this.$.stage.createComponent({ kind: name }, { owner: this });
      this.$.result.setContent(`Accepted as ${name}.`);
      this.log(`loaded spec accepted as ${name}`);
    },

  } satisfies CodeBehind,
);
