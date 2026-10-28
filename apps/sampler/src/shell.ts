import { kind, type Component, type ComponentEvent } from '@duyo/core';

import { SECTIONS } from './sections.js';

const LOG_LINES = 8;

/**
 * The sampler itself: a themed shell with the section list on the left, the chosen section
 * on the right, and a log of every event the sections raise.
 */
kind({
  name: 'Sampler.App',
  kind: 'mochi.ThemeWrapper',
  theme: 'dark',
  syncHtml: true,
  // Full height, so the section area scrolls rather than the page.
  style: 'height: 100%;',
  // Sections report what happened by bubbling `onLog`; it lands here.
  handlers: { onLog: 'appendLog' },
  components: [
    {
      kind: 'duyo.FittableRows',
      fill: true,
      components: [
        {
          kind: 'duyo.FittableColumns',
          align: 'center',
          gap: 'md',
          padding: 'md',
          components: [
            { kind: 'mochi.Header', content: 'Duyo Sampler', fit: true },
            { tag: 'span', name: 'themeLabel', content: 'Dark mode' },
            { kind: 'mochi.Toggle', name: 'themeToggle', value: true, onChange: 'themeToggled' },
          ],
        },
        {
          kind: 'duyo.FittableColumns',
          fit: true,
          components: [
            {
              kind: 'mochi.List',
              name: 'nav',
              style: 'width: 260px; overflow-y: auto;',
              components: SECTIONS.map((section) => ({
                kind: 'mochi.Item',
                name: `nav_${section.key}`,
                title: section.title,
                subtitle: section.subtitle,
                ontap: 'navigate',
              })),
            },
            { name: 'stage', fit: true, style: 'overflow-y: auto;' },
          ],
        },
        {
          tag: 'footer',
          name: 'log',
          style: 'font: 12px/1.5 ui-monospace, monospace; padding: 8px 16px; min-height: 9em; opacity: 0.85; white-space: pre-wrap; border-top: 1px solid rgba(127,127,127,0.3);',
          content: 'Events appear here.',
        },
      ],
    },
  ],

  create() {
    this.inherited(arguments);
    this.showSection(SECTIONS[0]!.key);
  },

  navigate(sender: Component) {
    this.showSection(String(sender.name).replace(/^nav_/, ''));
  },

  showSection(key: string) {
    const section = SECTIONS.find((s) => s.key === key);
    if (!section) return;
    this.$.stage!.destroyComponents();
    this.$.stage!.createComponent({ kind: section.kind, name: 'section' }, { owner: this });
    for (const s of SECTIONS) this.$[`nav_${s.key}`]!.setSelected(s.key === key);
    this.lines = [];
    this.$.log!.setContent(`${section.title}: events appear here.`);
  },

  themeToggled(_sender: Component, event: ComponentEvent) {
    const theme = event['value'] ? 'dark' : 'light';
    this.setTheme(theme);
    this.$.themeLabel!.setContent(theme === 'dark' ? 'Dark mode' : 'Light mode');
  },

  appendLog(_sender: Component, event: ComponentEvent) {
    const lines: string[] = [...(this.lines ?? []), String(event['text'])].slice(-LOG_LINES);
    this.lines = lines;
    this.$.log!.setContent(lines.join('\n'));
    return true;
  },
});
