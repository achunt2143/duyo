/**
 * Duyo.Button
 *
 * A minimal example of a custom Duyo kind built on top of enyo.Button.
 * Replace or extend this as needed.
 *
 * Usage in an app:
 *   { kind: 'Duyo.Button', content: 'Click me', ontap: 'handleTap' }
 */
/* global enyo */

enyo.kind({
  name: 'Duyo.Button',
  kind: 'enyo.Button',

  // -----------------------------------------------------------------------
  // Published properties — each gets a getter/setter automatically
  // -----------------------------------------------------------------------
  published: {
    /** Visual variant: 'default' | 'primary' | 'danger' */
    variant: 'default'
  },

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------
  create: function () {
    this.inherited(arguments);
    this.variantChanged();
  },

  // -----------------------------------------------------------------------
  // Property observers
  // -----------------------------------------------------------------------
  variantChanged: function () {
    this.removeClass('duyo-btn--default duyo-btn--primary duyo-btn--danger');
    this.addClass('duyo-btn duyo-btn--' + this.variant);
  }
});
