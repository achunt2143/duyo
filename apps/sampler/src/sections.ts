import { kind, type Component, type ComponentDefinition, type ComponentEvent } from '@duyo/core';

// Sampler.Buttons and Sampler.Loaded are written as views: views/Buttons.view.json is the design and
// views/Buttons.ts the behaviour. The other sections are inline kinds, for comparison.
import './views/Buttons.js';
import './views/Loaded.js';

/**
 * One kind per sampler section. Each extends Sampler.Section, whose `log()` bubbles an
 * `onLog` event up to the shell, so every interaction shows in the event log.
 */

export interface SectionInfo {
  key: string;
  title: string;
  subtitle: string;
  kind: string;
}

export const SECTIONS: SectionInfo[] = [
  { key: 'buttons', title: 'Buttons', subtitle: 'Button, ViewSelectButton, Toggle, Checkbox, Radio', kind: 'Sampler.Buttons' },
  { key: 'fields', title: 'Fields', subtitle: 'Input, TextArea, RichText, Dropdown, NumberInput, Slider, DateInput', kind: 'Sampler.Fields' },
  { key: 'display', title: 'Display', subtitle: 'ProgressBar, Spinner, Badge, Header, Subheader, Divider, NubbinDivider', kind: 'Sampler.Display' },
  { key: 'lists', title: 'Lists and data', subtitle: 'List, Item, ListItem, GridList, Table, Pagination', kind: 'Sampler.Lists' },
  { key: 'panels', title: 'Panels', subtitle: 'RepanelStack, Repanel, FloatingPanel, Collapsable', kind: 'Sampler.Panels' },
  { key: 'overlays', title: 'Menus and overlays', subtitle: 'SlidingMenu, Dialog, PopupPanel', kind: 'Sampler.Overlays' },
  { key: 'flow', title: 'Media and flow', subtitle: 'Video, Wizard', kind: 'Sampler.Flow' },
  { key: 'loaded', title: 'Loaded specs', subtitle: 'A screen from JSON at run time, with allow-lists', kind: 'Sampler.Loaded' },
];

const value = (event: ComponentEvent) => JSON.stringify(event['value']);

/** A caption above a group of demos. */
const caption = (text: string) => ({ kind: 'remochi.Subheader', content: text });

/** A horizontal row of controls. */
const row = (components: ComponentDefinition[]): ComponentDefinition => ({ kind: 'duyo.FittableColumns', align: 'center', gap: 'md', components });

/** A small text label. */
const text = (content: string, name?: string) => ({ tag: 'span', content, ...(name ? { name } : {}) });

/** A coloured square as an image, so the sampler needs no assets. */
const swatch = (colour: string, label: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="160" height="120" fill="${colour}"/><text x="80" y="66" font-family="sans-serif" font-size="18" fill="white" text-anchor="middle">${label}</text></svg>`,
  )}`;

kind({
  name: 'Sampler.Section',
  kind: 'duyo.FittableRows',
  gap: 'md',
  padding: 'lg',
  log(message: string) {
    this.bubble('onLog', { text: message });
  },
});

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

kind({
  name: 'Sampler.Fields',
  kind: 'Sampler.Section',
  components: [
    caption('Input'),
    row([
      { kind: 'remochi.Input', name: 'who', placeholder: 'Your name', onchange: 'committed' },
      text('Type, then press Enter or tab away.'),
    ]),
    caption('TextArea'),
    { kind: 'remochi.TextArea', name: 'notes', placeholder: 'Notes', onchange: 'committed' },
    caption('RichText'),
    { kind: 'remochi.RichText', name: 'rich', placeholder: 'Rich text: try Ctrl+B', onchange: 'committed' },
    caption('Dropdown and NumberInput'),
    row([
      {
        kind: 'remochi.Dropdown',
        name: 'fruit',
        options: [
          { value: 'apple', label: 'Apple' },
          { value: 'pear', label: 'Pear' },
          { value: 'plum', label: 'Plum' },
        ],
        onChange: 'changed',
      },
      { kind: 'remochi.NumberInput', name: 'quantity', label: 'Quantity', min: 0, max: 10, onChange: 'changed' },
    ]),
    caption('Slider (drives the progress bar)'),
    { kind: 'remochi.Slider', name: 'level', value: 30, onChange: 'levelled' },
    { kind: 'remochi.ProgressBar', name: 'levelBar', value: 30 },
    caption('DateInput'),
    { kind: 'remochi.DateInput', name: 'when', label: 'Date', onChange: 'changed' },
  ],
  committed(sender: Component) {
    this.log(`onchange: ${sender.name} = ${JSON.stringify(sender.value)}`);
  },
  changed(sender: Component, event: ComponentEvent) {
    this.log(`onChange: ${sender.name} = ${value(event)}`);
  },
  levelled(_sender: Component, event: ComponentEvent) {
    this.$.levelBar!.setValue(event['value']);
    this.log(`onChange: level = ${value(event)}`);
  },
});

// ---------------------------------------------------------------------------

kind({
  name: 'Sampler.Display',
  kind: 'Sampler.Section',
  components: [
    caption('ProgressBar'),
    { kind: 'remochi.ProgressBar', value: 25 },
    { kind: 'remochi.ProgressBar', value: 60, color: 'yellow' },
    { kind: 'remochi.ProgressBar', value: 90, color: 'red' },
    caption('Spinner'),
    row([
      { kind: 'remochi.Spinner' },
      { kind: 'remochi.Spinner', size: 'large' },
      { kind: 'remochi.Spinner', styleType: 'dark' },
      { kind: 'remochi.Spinner', styleType: 'dark', size: 'large' },
    ]),
    caption('Badge'),
    row([
      { kind: 'remochi.Badge', content: 'Default' },
      { kind: 'remochi.Badge', content: 'Success', variant: 'success' },
      { kind: 'remochi.Badge', content: 'Warning', variant: 'warning' },
      { kind: 'remochi.Badge', content: 'Error', variant: 'error' },
      { kind: 'remochi.Badge', content: 'Info', variant: 'info' },
      { kind: 'remochi.Badge', content: 'Inbox', count: 7 },
    ]),
    caption('Header and Subheader'),
    { kind: 'remochi.Header', content: 'A Header' },
    { kind: 'remochi.Subheader', content: 'A Subheader' },
    caption('Divider'),
    { kind: 'remochi.Divider' },
    caption('NubbinDivider'),
    { kind: 'remochi.NubbinDivider', nubbin: 'up' },
    { kind: 'remochi.NubbinDivider', nubbin: 'down', nubbinOffset: '25%' },
    { kind: 'remochi.NubbinDivider', nubbin: 'top-left-up' },
  ],
});

// ---------------------------------------------------------------------------

kind({
  name: 'Sampler.Lists',
  kind: 'Sampler.Section',
  components: [
    caption('List, ListHeader and ListItem'),
    {
      kind: 'remochi.List',
      style: 'max-width: 420px;',
      components: [
        { kind: 'remochi.ListHeader', content: 'Inbox' },
        { kind: 'remochi.ListItem', name: 'mail1', content: 'Lunch on Friday?', ontap: 'tapped' },
        { kind: 'remochi.ListItem', name: 'mail2', content: 'Your parcel has shipped', ontap: 'tapped' },
        { kind: 'remochi.ListItem', name: 'mail3', content: 'Build passed', ontap: 'tapped' },
      ],
    },
    caption('Item'),
    {
      style: 'max-width: 420px;',
      components: [
        { kind: 'remochi.Item', name: 'item1', title: 'Andrew', subtitle: 'Online', icon: '👤', ontap: 'tapped', onIconTap: 'iconTapped' },
        { kind: 'remochi.Item', name: 'item2', title: 'Compact item', variant: 'compact', ontap: 'tapped' },
        { kind: 'remochi.Item', name: 'item3', title: 'Detailed item', subtitle: 'With a subtitle', rightContent: '3m', variant: 'detailed', ontap: 'tapped' },
        { kind: 'remochi.Item', name: 'item4', title: 'Disabled item', disabled: true, ontap: 'tapped' },
      ],
    },
    caption('GridList'),
    {
      kind: 'remochi.GridList',
      columns: 4,
      style: 'max-width: 720px;',
      components: [
        ['#e05d44', 'Red'], ['#dfb317', 'Yellow'], ['#4c1', 'Green'], ['#007ec6', 'Blue'],
      ].map(([colour, name]) => ({
        kind: 'remochi.GridListImageItem',
        name: `tile${name}`,
        src: swatch(colour!, name!),
        caption: name,
        onSelect: 'picked',
      })),
    },
    caption('Table'),
    {
      kind: 'remochi.Table',
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'device', label: 'Device' },
        { key: 'year', label: 'Year' },
      ],
      rows: [
        { name: 'Pre', device: 'Phone', year: 2009 },
        { name: 'Pixi', device: 'Phone', year: 2009 },
        { name: 'Veer', device: 'Phone', year: 2011 },
        { name: 'TouchPad', device: 'Tablet', year: 2011 },
      ],
      striped: true,
      onRowTap: 'rowTapped',
    },
    caption('Pagination'),
    { kind: 'remochi.Pagination', name: 'pages', totalPages: 12, onChange: 'paged' },
  ],
  tapped(sender: Component) {
    this.log(`ontap: ${sender.name}`);
  },
  iconTapped(sender: Component) {
    this.log(`onIconTap: ${sender.name}`);
  },
  picked(sender: Component, event: ComponentEvent) {
    this.log(`onSelect: ${sender.name} = ${value(event)}`);
  },
  rowTapped(_sender: Component, event: ComponentEvent) {
    this.log(`onRowTap: ${JSON.stringify(event['row'])}`);
  },
  paged(_sender: Component, event: ComponentEvent) {
    this.log(`onChange: page ${value(event)}`);
  },
});

// ---------------------------------------------------------------------------

kind({
  name: 'Sampler.Panels',
  kind: 'Sampler.Section',
  components: [
    caption('RepanelStack'),
    row([
      { kind: 'remochi.Button', content: 'Previous', ontap: 'previous' },
      { kind: 'remochi.Button', content: 'Next', ontap: 'next' },
      text('', 'stackState'),
    ]),
    {
      kind: 'remochi.RepanelStack',
      name: 'stack',
      activeIndex: 2,
      style: 'height: 320px;',
      onActiveIndexChange: 'stackMoved',
      components: ['Accounts', 'Folders', 'Messages'].map((title, index) => ({
        kind: 'remochi.Repanel',
        name: `panel${index}`,
        components: [
          { kind: 'remochi.Header', content: title },
          { kind: 'duyo.Control', style: 'padding: 12px;', content: `Panel ${index + 1}. Drag the nubbin, or use Previous and Next.` },
        ],
      })),
    },
    caption('FloatingPanel'),
    {
      kind: 'remochi.FloatingPanel',
      look: 'shadow',
      style: 'max-width: 360px;',
      components: [{ style: 'padding: 16px;', content: 'A floating panel with the shadow look.' }],
    },
    caption('Collapsable'),
    row([{ kind: 'remochi.Button', content: 'Open and close from code', ontap: 'toggleDetails' }]),
    {
      kind: 'remochi.Collapsable',
      name: 'details',
      title: 'Details',
      onToggle: 'toggled',
      style: 'max-width: 420px;',
      components: [
        { kind: 'remochi.CollapsableItem', content: 'First item' },
        { kind: 'remochi.CollapsableItem', content: 'Second item' },
        { kind: 'remochi.CollapsableFooter' },
      ],
    },
    { kind: 'remochi.CollapsableHeader', content: 'A standalone CollapsableHeader', ontap: 'headerTapped' },
  ],
  create() {
    this.inherited(arguments);
    this.showStackState();
  },
  next() {
    this.$.stack!.next();
    this.showStackState();
  },
  previous() {
    this.$.stack!.previous();
    this.showStackState();
  },
  stackMoved(_sender: Component, event: ComponentEvent) {
    this.showStackState();
    this.log(`onActiveIndexChange: ${event['index']} (${event['reason']})`);
  },
  showStackState() {
    this.$.stackState!.setContent(`Front panel: ${(this.$.stack!.activeIndex ?? 2) + 1} of 3`);
  },
  toggleDetails() {
    this.$.details!.setExpanded(!this.$.details!.expanded);
    this.log(`set from code: details.expanded = ${this.$.details!.expanded}`);
  },
  toggled(_sender: Component, event: ComponentEvent) {
    this.log(`onToggle: expanded = ${event['expanded']}`);
  },
  headerTapped() {
    this.log('ontap: CollapsableHeader');
  },
});

// ---------------------------------------------------------------------------

kind({
  name: 'Sampler.Overlays',
  kind: 'Sampler.Section',
  components: [
    caption('SlidingMenu and its content shifter'),
    row([{ kind: 'remochi.Button', content: 'Open the menu', ontap: 'toggleMenu' }]),
    {
      kind: 'remochi.SlidingMenu',
      name: 'nav',
      onOpenChange: 'menuChanged',
      components: [
        {
          kind: 'remochi.SlidingMenuItemGroup',
          label: 'Places',
          divider: true,
          components: [
            { kind: 'remochi.SlidingMenuItem', name: 'home', content: 'Home', icon: '🏠', active: true, ontap: 'went' },
            { kind: 'remochi.SlidingMenuItem', name: 'mail', content: 'Mail', icon: '✉️', badge: 3, ontap: 'went' },
          ],
        },
        {
          kind: 'remochi.SlidingMenuItemGroup',
          label: 'Account',
          components: [
            { kind: 'remochi.SlidingMenuItem', name: 'signOut', content: 'Sign out', variant: 'danger', ontap: 'went' },
          ],
        },
      ],
    },
    {
      kind: 'remochi.SlidingMenuContentShifter',
      menu: 'nav',
      components: [
        { style: 'padding: 12px; border: 1px dashed rgba(127,127,127,0.5);', content: 'This content moves aside when the menu opens.' },
      ],
    },
    caption('Dialog'),
    row([
      { kind: 'remochi.Button', content: 'Confirm', ontap: 'openConfirm' },
      { kind: 'remochi.Button', content: 'Prompt', ontap: 'openPrompt' },
      { kind: 'remochi.Button', content: 'Alert', ontap: 'openAlert' },
      { kind: 'remochi.Button', content: 'Custom actions', ontap: 'openCustom' },
    ]),
    {
      kind: 'remochi.Dialog',
      name: 'confirm',
      title: 'Delete this message?',
      dialogType: 'confirm',
      confirmText: 'Delete',
      confirmType: 'warning',
      onConfirm: 'confirmed',
      onCancel: 'cancelled',
      components: [{ content: 'This cannot be undone.' }],
    },
    { kind: 'remochi.Dialog', name: 'prompt', title: 'Rename', dialogType: 'prompt', onConfirm: 'confirmed', onCancel: 'cancelled' },
    { kind: 'remochi.Dialog', name: 'alert', title: 'Heads up', dialogType: 'alert', onConfirm: 'confirmed', components: [{ content: 'Something happened.' }] },
    {
      kind: 'remochi.Dialog',
      name: 'custom',
      title: 'Sync failed',
      actions: [
        { label: 'Later', action: 'later' },
        { label: 'Retry', action: 'retry', type: 'affirmative' },
      ],
      onAction: 'acted',
      components: [{ content: 'Custom actions are plain data and raise onAction.' }],
    },
    caption('PopupPanel'),
    row([{ kind: 'remochi.Button', name: 'more', content: 'More…', variant: 'dropdown', ontap: 'openPopup' }]),
    {
      kind: 'remochi.PopupPanel',
      name: 'popup',
      anchor: 'more',
      title: 'Options',
      actions: [
        { label: 'Rename', action: 'rename' },
        { label: 'Delete', action: 'delete', type: 'warning' },
      ],
      onAction: 'acted',
      onClose: 'popupClosed',
      components: [{ style: 'padding: 8px;', content: 'Anchored to the More button by name.' }],
    },
  ],
  toggleMenu() {
    this.$.nav!.toggle();
  },
  menuChanged(_sender: Component, event: ComponentEvent) {
    this.log(`onOpenChange: ${value(event)}`);
  },
  went(sender: Component) {
    this.log(`ontap: ${sender.name}`);
    this.$.nav!.setOpen(false);
  },
  openConfirm() {
    this.$.confirm!.setOpen(true);
  },
  openPrompt() {
    this.$.prompt!.setOpen(true);
  },
  openAlert() {
    this.$.alert!.setOpen(true);
  },
  openCustom() {
    this.$.custom!.setOpen(true);
  },
  openPopup() {
    this.$.popup!.setOpen(true);
  },
  confirmed(sender: Component, event: ComponentEvent) {
    this.log(`onConfirm: ${sender.name} = ${value(event)}`);
  },
  cancelled(sender: Component) {
    this.log(`onCancel: ${sender.name}`);
  },
  acted(sender: Component, event: ComponentEvent) {
    this.log(`onAction: ${sender.name} -> ${event['action']}`);
    sender.setOpen(false);
  },
  popupClosed() {
    this.log('onClose: popup');
  },
});

// ---------------------------------------------------------------------------

kind({
  name: 'Sampler.Flow',
  kind: 'Sampler.Section',
  components: [
    caption('Video'),
    {
      kind: 'remochi.Video',
      src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      muted: true,
      style: 'max-width: 480px;',
      onPlay: 'media',
      onPause: 'media',
      onEnded: 'media',
    },
    caption('Wizard (step 1 will not continue until a name is entered)'),
    {
      kind: 'remochi.Wizard',
      name: 'wizard',
      onStepChange: 'stepped',
      onComplete: 'completed',
      onCancel: 'cancelled',
      components: [
        {
          kind: 'remochi.WizardStep',
          label: 'Account',
          title: 'Create your account',
          description: 'Next is refused while the name is empty.',
          onNext: 'checkName',
          components: [{ kind: 'remochi.Input', name: 'accountName', placeholder: 'Name' }],
        },
        {
          kind: 'remochi.WizardStep',
          label: 'Preferences',
          title: 'Preferences',
          skippable: true,
          components: [
            { kind: 'duyo.FittableColumns', align: 'center', gap: 'md', components: [{ kind: 'remochi.Toggle' }, { tag: 'span', content: 'Send me updates' }] },
          ],
        },
        { kind: 'remochi.WizardStep', label: 'Done', title: 'All set', components: [{ content: 'Press Finish.' }] },
      ],
    },
  ],
  media(_sender: Component, event: ComponentEvent) {
    this.log(`video: ${event.type ?? 'event'}`);
  },
  checkName() {
    const name = String(this.$.accountName!.value ?? '').trim();
    if (name === '') {
      this.log('onNext: refused, the name is empty');
      return true;
    }
    this.log(`onNext: ok, hello ${name}`);
    return false;
  },
  stepped(_sender: Component, event: ComponentEvent) {
    this.log(`onStepChange: ${event['step']} (${event['reason']})`);
  },
  completed() {
    this.log('onComplete');
  },
  cancelled() {
    this.log('onCancel');
  },
});
