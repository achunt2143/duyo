import { kind, type Component, type ComponentEvent } from '@duyo/core';

import { SECTIONS } from './sections.js';

const LOG_LINES = 8;

/** A ThemeWrapper mode switch: its label, the property it sets, and the choices (the first is `system`/default). */
const MODES = [
  { property: 'motion', label: 'Motion', choices: ['system', 'full', 'reduced', 'off'] },
  { property: 'contrast', label: 'Contrast', choices: ['system', 'more'] },
  { property: 'transparency', label: 'Transparency', choices: ['system', 'reduced'] },
  { property: 'ground', label: 'Ground', choices: ['plain', 'vignette'] },
];

const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * The sampler itself: a themed shell with the section list on the left, the chosen section
 * on the right, and a log of every event the sections raise.
 */
kind({
  name: 'Sampler.App',
  kind: 'remochi.ThemeWrapper',
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
            { kind: 'remochi.Header', content: 'Duyo Sampler', fit: true },
            { tag: 'span', name: 'themeLabel', content: 'Dark mode' },
            { kind: 'remochi.Toggle', name: 'themeToggle', value: true, onChange: 'themeToggled' },
          ],
        },
        // The ThemeWrapper's accessibility and ground modes, written to <html> as data attributes.
        {
          kind: 'duyo.FittableColumns',
          align: 'center',
          gap: 'md',
          padding: 'md',
          style: 'flex-wrap: wrap; padding-top: 0;',
          components: MODES.flatMap((mode) => [
            { kind: 'remochi.Label', content: mode.label },
            {
              kind: 'remochi.ViewSelectButton',
              name: `${mode.property}Select`,
              items: mode.choices.map((choice) => ({ content: capitalised(choice), value: choice })),
              onSelect: 'modeSelected',
            },
          ]),
        },
        {
          kind: 'duyo.FittableColumns',
          fit: true,
          components: [
            {
              kind: 'remochi.List',
              name: 'nav',
              style: 'width: 260px; overflow-y: auto;',
              components: SECTIONS.map((section) => ({
                kind: 'remochi.Item',
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

  // The ThemeWrapper is this kind, so each choice is one of its own properties.
  modeSelected(sender: Component, event: ComponentEvent) {
    const property = String(sender.name).replace(/Select$/, '');
    this.set(property, event['value']);
    this.appendLog(sender, { text: `ThemeWrapper.${property} = ${event['value']}` });
  },

  appendLog(_sender: Component, event: ComponentEvent) {
    const lines: string[] = [...(this.lines ?? []), String(event['text'])].slice(-LOG_LINES);
    this.lines = lines;
    this.$.log!.setContent(lines.join('\n'));
    return true;
  },
});
