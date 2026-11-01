import { kind, type Component, type ComponentDefinition, type ComponentEvent } from '@duyo/core';

// The icon sprite Onyx's own icon buttons use: two states, one above the other.
import moreIcon from '../../../packages/onyx/src/images/more.png';

/**
 * The Onyx pack, as Enyo's Onyx sampler showed it. Each section's root carries the `onyx`
 * class, which gives it Onyx's page look inside this Remochi-themed shell.
 */

const header = (content: string): ComponentDefinition => ({ kind: 'onyx.GroupboxHeader', content });
const row = (components: ComponentDefinition[]): ComponentDefinition => ({ kind: 'duyo.FittableColumns', align: 'center', gap: 'md', components });

const FRUIT = ['Apple', 'Pear', 'Plum', 'Quince'];

kind({
  name: 'Sampler.OnyxControls',
  kind: 'Sampler.Section',
  classes: 'onyx',
  components: [
    header('Toolbar'),
    {
      kind: 'onyx.Toolbar',
      components: [
        // drag it: a grabber raises Enyo's drag events
        { kind: 'onyx.Grabber', ondragstart: 'grabbed', ondragfinish: 'grabbed' },
        { kind: 'onyx.Button', content: 'Back', ontap: 'tapped' },
        { kind: 'onyx.Button', content: 'Forward', ontap: 'tapped' },
        { kind: 'onyx.InputDecorator', components: [{ kind: 'onyx.Input', placeholder: 'Search', oninput: 'typed' }] },
        { kind: 'onyx.IconButton', src: moreIcon, ontap: 'tapped' },
        { kind: 'onyx.ToggleIconButton', src: moreIcon, onChange: 'changed' },
      ],
    },

    header('Buttons'),
    row([
      { kind: 'onyx.Button', content: 'Button', ontap: 'tapped' },
      { kind: 'onyx.Button', content: 'Affirmative', classes: 'onyx-affirmative', ontap: 'tapped' },
      { kind: 'onyx.Button', content: 'Negative', classes: 'onyx-negative', ontap: 'tapped' },
      { kind: 'onyx.Button', content: 'Blue', classes: 'onyx-blue', ontap: 'tapped' },
      { kind: 'onyx.Button', content: 'Dark', classes: 'onyx-dark', ontap: 'tapped' },
      { kind: 'onyx.Button', content: 'Light', classes: 'onyx-light', ontap: 'tapped' },
      { kind: 'onyx.Button', content: 'Disabled', disabled: true },
    ]),

    header('RadioGroup and tab buttons'),
    {
      kind: 'onyx.RadioGroup',
      onActiveChanged: 'radioChanged',
      components: [
        { content: 'Day' },
        { content: 'Week', active: true },
        { content: 'Month' },
      ],
    },
    {
      kind: 'onyx.RadioGroup',
      onActiveChanged: 'radioChanged',
      components: [
        { content: 'One', classes: 'onyx-tabbutton', active: true },
        { content: 'Two', classes: 'onyx-tabbutton' },
        { content: 'Three', classes: 'onyx-tabbutton' },
      ],
    },

    header('Checkbox and ToggleButton'),
    row([
      { kind: 'onyx.Checkbox', onChange: 'changed' },
      { kind: 'onyx.Checkbox', checked: true, onChange: 'changed' },
      { kind: 'onyx.Checkbox', disabled: true },
      { kind: 'onyx.ToggleButton', onChange: 'changed' },
      { kind: 'onyx.ToggleButton', value: true, labelOn: 'Yes', labelOff: 'No', onChange: 'changed' },
      { kind: 'onyx.ToggleButton', disabled: true },
    ]),

    header('Inputs in a Groupbox'),
    {
      kind: 'onyx.Groupbox',
      style: 'max-width: 420px;',
      components: [
        { kind: 'onyx.GroupboxHeader', content: 'Contact' },
        { kind: 'onyx.InputDecorator', components: [{ kind: 'onyx.Input', placeholder: 'Name', oninput: 'typed' }] },
        { kind: 'onyx.InputDecorator', components: [{ kind: 'onyx.Input', type: 'password', placeholder: 'Password' }] },
        { kind: 'onyx.InputDecorator', components: [{ kind: 'onyx.TextArea', placeholder: 'Notes', rows: 3 }] },
        { kind: 'onyx.InputDecorator', components: [{ kind: 'onyx.RichText', placeholder: 'Rich text' }] },
        { kind: 'onyx.InputDecorator', alwaysLooksFocused: true, components: [{ kind: 'onyx.Input', value: 'Always looks focused' }] },
        { kind: 'onyx.InputDecorator', components: [{ kind: 'onyx.Input', disabled: true, placeholder: 'Disabled' }] },
      ],
    },

    // from the Onyx theme of webOS's Enyo 1.0: a rounded card of rows
    header('RowGroup (webOS)'),
    {
      kind: 'onyx.RowGroup',
      name: 'rows',
      caption: 'Audio/Video Options',
      style: 'max-width: 420px;',
      components: [{ content: 'Sound' }, { content: 'Video' }, { content: 'Subtitles' }],
    },
    { kind: 'onyx.RowGroup', style: 'max-width: 420px;', components: [{ content: 'A group without a caption' }, { content: 'Its rows have guide lines between them' }] },
    row([
      { kind: 'onyx.Button', content: 'Hide Video', ontap: 'hideVideo' },
      { kind: 'onyx.Button', content: 'Show it again', ontap: 'showVideo' },
    ]),

    header('Items'),
    {
      kind: 'onyx.Groupbox',
      style: 'max-width: 420px;',
      components: [
        { kind: 'onyx.Item', content: 'An item you can press', ontap: 'tapped' },
        { kind: 'onyx.Item', content: 'A selected item', selected: true },
        { kind: 'onyx.Item', content: 'No tap highlight', tapHighlight: false },
      ],
    },

    header('Progress and sliders'),
    { kind: 'onyx.ProgressBar', name: 'bar', progress: 40 },
    row([
      { kind: 'onyx.Button', content: 'Animate to 90', ontap: 'animateBar' },
      { kind: 'onyx.Button', content: 'Back to 10', ontap: 'resetBar' },
    ]),
    { kind: 'onyx.ProgressBar', progress: 70, showStripes: false },
    { kind: 'onyx.ProgressButton', progress: 55, content: 'Downloading…', onCancel: 'cancelled' },
    { kind: 'onyx.Slider', name: 'level', value: 30, onChanging: 'sliding', onChange: 'changed' },
    { kind: 'onyx.Slider', value: 60, increment: 10, lockBar: false, progress: 20, onChange: 'changed' },
    { kind: 'onyx.RangeSlider', rangeStart: 25, rangeEnd: 75, showLabels: true, startLabel: 'from', endLabel: 'to', onChange: 'changed' },

    // The default spinner is for dark backgrounds, `onyx-light` for light ones.
    header('Spinner'),
    row([
      { kind: 'onyx.Spinner', classes: 'onyx-light' },
      { classes: 'onyx-dark', components: [{ kind: 'onyx.Spinner' }] },
      { kind: 'onyx.Grabber' },
    ]),
  ],

  tapped(sender: Component) {
    this.log(`ontap: ${sender.kind} ${sender.get('content') ?? ''}`);
  },
  typed(_sender: Component, event: ComponentEvent) {
    this.log(`oninput: ${JSON.stringify(event['value'])}`);
  },
  changed(sender: Component, event: ComponentEvent) {
    this.log(`onChange: ${sender.kind} = ${JSON.stringify(event['value'])}`);
  },
  sliding(_sender: Component, event: ComponentEvent) {
    this.$.bar!.setProgress(event['value']);
  },
  hideVideo() {
    this.$.rows!.hideRow(1);
  },
  showVideo() {
    this.$.rows!.showRow(1);
  },
  grabbed(_sender: Component, event: ComponentEvent) {
    this.log(`${event['type']}: dx ${event['dx']}, dy ${event['dy']}, ${event['horizontal'] ? 'horizontal' : 'vertical'}`);
  },
  radioChanged(_sender: Component, event: ComponentEvent) {
    this.log(`onActiveChanged: ${event['active']?.get('content') ?? 'none'}`);
  },
  animateBar() {
    this.$.bar!.animateProgressTo(90);
  },
  resetBar() {
    this.$.bar!.animateProgressTo(10);
  },
  cancelled() {
    this.log('onCancel: progress button');
  },
});

// ---------------------------------------------------------------------------

kind({
  name: 'Sampler.OnyxOverlays',
  kind: 'Sampler.Section',
  classes: 'onyx',
  components: [
    header('Menu'),
    {
      kind: 'onyx.MenuDecorator',
      style: 'display: inline-block;',
      components: [
        { content: 'Open menu' },
        {
          kind: 'onyx.Menu',
          components: [
            { content: 'Cut', onSelect: 'selected' },
            { content: 'Copy', onSelect: 'selected' },
            { content: 'Paste', onSelect: 'selected' },
            { classes: 'onyx-menu-divider' },
            { kind: 'onyx.Submenu', content: 'More', components: [{ content: 'Select all', onSelect: 'selected' }, { content: 'Find…', onSelect: 'selected' }] },
          ],
        },
      ],
    },

    header('Pickers'),
    row([
      {
        kind: 'onyx.PickerDecorator',
        onSelect: 'selected',
        components: [{ style: 'min-width: 120px;' }, { kind: 'onyx.Picker', components: FRUIT.map((content, index) => ({ content, active: index === 1 })) }],
      },
      {
        kind: 'onyx.PickerDecorator',
        onSelect: 'selected',
        components: [{ style: 'min-width: 60px;' }, { kind: 'onyx.IntegerPicker', min: 1, max: 20, value: 7 }],
      },
      {
        kind: 'onyx.PickerDecorator',
        onSelect: 'selected',
        components: [
          { style: 'min-width: 90px;' },
          { kind: 'onyx.FlyweightPicker', count: 300, selected: 12, onSetupItem: 'setupRow', scrolling: true },
        ],
      },
    ]),

    header('DatePicker and TimePicker'),
    row([
      { kind: 'onyx.DatePicker', value: '2026-10-31', onSelect: 'picked' },
      { kind: 'onyx.TimePicker', value: '14:05', onSelect: 'picked' },
      { kind: 'onyx.TimePicker', value: '09:30', is24HrMode: true, onSelect: 'picked' },
    ]),

    header('Popup, ContextualPopup and Tooltip'),
    row([
      { kind: 'onyx.Button', content: 'Open popup', ontap: 'openPopup' },
      {
        kind: 'onyx.MenuDecorator',
        components: [
          { content: 'Contextual popup' },
          {
            kind: 'onyx.ContextualPopup',
            title: 'Delete the file?',
            actionButtons: [{ content: 'Delete', classes: 'onyx-negative', action: 'delete' }, { content: 'Cancel' }],
            onAction: 'acted',
            components: [{ content: 'It cannot be undone.' }],
          },
        ],
      },
      {
        kind: 'onyx.TooltipDecorator',
        components: [{ kind: 'onyx.Button', content: 'Hover me' }, { kind: 'onyx.Tooltip', content: 'A tooltip' }],
      },
    ]),
    {
      kind: 'onyx.Popup',
      name: 'popup',
      centered: true,
      floating: true,
      modal: true,
      scrim: true,
      components: [
        { content: 'A modal popup with a scrim.', style: 'padding: 8px;' },
        { kind: 'onyx.Button', content: 'Close', ontap: 'closePopup' },
      ],
    },

    header('Drawer'),
    { kind: 'onyx.Button', content: 'Toggle drawer', ontap: 'toggleDrawer' },
    { kind: 'onyx.Drawer', name: 'drawer', open: false, components: [{ kind: 'onyx.Item', content: 'Inside the drawer' }] },

    header('MoreToolbar (narrow, so some buttons move into its menu)'),
    {
      kind: 'onyx.MoreToolbar',
      style: 'width: 420px;',
      components: ['Open', 'Save', 'Print', 'Share', 'Export', 'Delete'].map((content) => ({ kind: 'onyx.Button', content, ontap: 'tapped' })),
    },

    header('TabBar'),
    {
      kind: 'onyx.TabBar',
      name: 'tabs',
      tabs: [{ caption: 'Inbox' }, { caption: 'Drafts', tooltipMsg: 'Unsent mail' }, { caption: 'Sent' }, { caption: 'Archive' }],
      onTabChanged: 'tabChanged',
    },
    row([
      { kind: 'onyx.Button', content: 'Add tab', ontap: 'addTab' },
    ]),

    // from webOS's Enyo 1.0: views that slide over one another. Each is a Header, a scrolling child and a Toolbar
    // holding a GrabButton. Drag a view left, or tap a grab button
    header('SlidingPane (webOS): drag a view left, or tap a grab button'),
    {
      kind: 'onyx.SlidingPane',
      style: 'height: 320px; max-width: 760px;',
      onSelectView: 'viewSelected',
      components: [
        {
          name: 'listView',
          style: 'width: 200px;',
          components: [
            { kind: 'onyx.Header', content: 'Mail' },
            {
              fit: true,
              style: 'overflow: auto;',
              components: [
                { kind: 'onyx.Item', content: 'Dashboard' },
                { kind: 'onyx.Divider', caption: 'MY MAIL' },
                { kind: 'onyx.Item', content: 'Inbox', classes: 'onyx-selected' },
                { kind: 'onyx.Item', content: 'Sent' },
                { kind: 'onyx.Item', content: 'Drafts' },
              ],
            },
          ],
        },
        {
          name: 'detailView',
          style: 'width: 280px;',
          peekWidth: 48,
          components: [
            { kind: 'onyx.Header', content: 'Inbox' },
            {
              fit: true,
              style: 'overflow: auto;',
              components: [
                { kind: 'onyx.Item', content: 'The middle view peeks out from under the last' },
                { kind: 'onyx.Divider', caption: 'EARLIER' },
                { kind: 'onyx.Item', content: 'A Divider is a caption between two rules' },
              ],
            },
            { kind: 'onyx.Toolbar', components: [{ kind: 'onyx.GrabButton' }] },
          ],
        },
        {
          name: 'moreView',
          fit: true,
          peekWidth: 48,
          components: [
            {
              kind: 'onyx.Header',
              components: [{ content: 'The last view', fit: true }, { kind: 'onyx.Button', content: 'Follow' }],
            },
            { fit: true, style: 'overflow: auto; padding: 10px;', content: 'The last view takes what is left, and a child with fit fills it.' },
            { kind: 'onyx.Toolbar', components: [{ kind: 'onyx.GrabButton' }] },
          ],
        },
      ],
    },

    // more of webOS's Enyo 1.0: a divider that folds what is under it, a row to swipe away, and the popups that slide in
    header('Dividers, DividerDrawer and SwipeableItem (webOS)'),
    {
      style: 'max-width: 420px; background: #d8d8d8;',
      components: [
        { kind: 'onyx.Header', dark: true, content: 'A dark header' },
        {
          kind: 'onyx.DividerDrawer',
          caption: 'Tap to fold what is under me',
          components: [
            { kind: 'onyx.Item', content: 'First row' },
            { kind: 'onyx.Item', content: 'Second row' },
          ],
        },
        { kind: 'onyx.AlphaDivider', caption: 'S' },
        { kind: 'onyx.SwipeableItem', content: 'Swipe me aside', onConfirm: 'rowConfirmed', onCancel: 'rowCancelled' },
      ],
    },
    header('Toaster, Dialog, DialogPrompt and ModalDialog (webOS)'),
    {
      // a screen of its own for them to slide into: a transform makes it what a fixed element is fixed to
      style: 'position: relative; height: 300px; max-width: 760px; overflow: hidden; background: #d8d8d8; transform: translateZ(0);',
      components: [
        {
          kind: 'duyo.FittableColumns',
          gap: 'sm',
          style: 'padding: 10px;',
          components: [
            { kind: 'onyx.Button', content: 'Toaster', ontap: 'openToaster' },
            { kind: 'onyx.Button', content: 'Dialog', ontap: 'openDialog' },
            { kind: 'onyx.Button', content: 'DialogPrompt', ontap: 'openPrompt' },
            { kind: 'onyx.Button', content: 'ModalDialog', ontap: 'openModal' },
          ],
        },
        {
          kind: 'onyx.Toaster',
          name: 'toaster',
          flyInFrom: 'right',
          style: 'top: 0; bottom: 0; width: 240px; background: #eee;',
          components: [
            { content: 'A toaster slides in from an edge.', style: 'padding: 20px;' },
            { kind: 'onyx.Button', content: 'Close', ontap: 'closeToaster' },
          ],
        },
        {
          kind: 'onyx.Dialog',
          name: 'dialog',
          components: [
            { content: 'A dialog comes up from the bottom.', style: 'padding: 0 14px 14px;' },
            { kind: 'onyx.Button', content: 'Close', ontap: 'closeDialog' },
          ],
        },
        { kind: 'onyx.DialogPrompt', name: 'prompt', title: 'Mood prompt', message: 'Are you having a good day?', acceptButtonCaption: 'Yes', cancelButtonCaption: 'No', onAccept: 'answered', onCancel: 'answered' },
        {
          kind: 'onyx.ModalDialog',
          name: 'modal',
          caption: 'Dialog title',
          components: [
            { content: 'A modal dialog is a titled box in the middle of the screen.', style: 'padding: 4px 0 10px;' },
            { kind: 'onyx.Button', content: 'Close', ontap: 'closeModal' },
          ],
        },
      ],
    },

    header('TabPanels'),
    {
      kind: 'onyx.TabPanels',
      style: 'height: 140px;',
      components: [
        { kind: 'onyx.TabPanel', caption: 'Overview', components: [{ kind: 'onyx.Item', content: 'The overview panel.' }] },
        { kind: 'onyx.TabPanel', caption: 'Details', components: [{ kind: 'onyx.Item', content: 'The details panel.' }] },
        { kind: 'onyx.TabPanel', caption: 'History', components: [{ kind: 'onyx.Item', content: 'The history panel.' }] },
      ],
      onTabChanged: 'tabChanged',
    },
  ],

  tapped(sender: Component) {
    this.log(`ontap: ${sender.get('content')}`);
  },
  selected(_sender: Component, event: ComponentEvent) {
    this.log(`onSelect: ${event['content']}`);
  },
  setupRow(_sender: Component, event: ComponentEvent) {
    event['content'] = `Row ${event['index']}`;
    return true;
  },
  picked(sender: Component, event: ComponentEvent) {
    this.log(`onSelect: ${sender.kind} = ${event['value']}`);
  },
  acted(_sender: Component, event: ComponentEvent) {
    this.log(`onAction: ${event['action']}`);
    return true;
  },
  openPopup() {
    this.$.popup!.show();
  },
  closePopup() {
    this.$.popup!.hide();
  },
  toggleDrawer() {
    this.$.drawer!.toggleOpen();
  },
  addTab() {
    this.$.tabs!.addTab({ caption: `Tab ${this.$.tabs!.tabs.length}` });
  },
  rowConfirmed() {
    this.log('SwipeableItem: onConfirm');
  },
  rowCancelled() {
    this.log('SwipeableItem: onCancel');
  },
  openToaster() {
    this.$.toaster!.open();
  },
  closeToaster() {
    this.$.toaster!.close();
  },
  openDialog() {
    this.$.dialog!.open();
  },
  closeDialog() {
    this.$.dialog!.close();
  },
  openPrompt() {
    this.$.prompt!.open();
  },
  answered(sender: Component) {
    this.log(`DialogPrompt: ${sender.get('title')} answered`);
  },
  openModal() {
    this.$.modal!.openAtCenter();
  },
  closeModal() {
    this.$.modal!.close();
  },
  viewSelected(_sender: Component, event: ComponentEvent) {
    this.log(`onSelectView: ${event['view'].name}`);
  },
  tabChanged(_sender: Component, event: ComponentEvent) {
    this.log(`onTabChanged: ${event['caption']}`);
  },
});
