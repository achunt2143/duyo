import type { Component } from './component.js';
import type { ControlMembers } from './control.gen.js';

export type { ControlMembers } from './control.gen.js';

/**
 * Maps a kind name to the members its instances have: published properties with their
 * getters and setters, event helpers and methods. A kind pack fills it in with a
 * generated declaration (see `generateKindTypes` in `@duyo/views`):
 *
 *     declare module '@duyo/core' {
 *       interface KindTypes { 'acme.Button': AcmeButton }
 *     }
 *
 * Types are an editor convenience; nothing at runtime reads this.
 */
export interface KindTypes {
  'duyo.Control': ControlMembers;
}

/**
 * The component a kind creates, typed as far as its pack described it. Kinds nobody has
 * described are plain `Component`s, so unknown kinds never get in the way.
 */
export type Instance<K extends string> = Component & (K extends keyof KindTypes ? KindTypes[K] : unknown);
