# Changelog

## 1.1.0

First release as one package: `@duyojs/duyo`. It holds what were the libraries of this repository, now its imports:
`@duyojs/duyo` (the core), `@duyojs/duyo/layout`, `@duyojs/duyo/react`, `@duyojs/duyo/views` (with `spec`, `load` and `vite`), `@duyojs/duyo/remochi`
and `@duyojs/duyo/onyx` (each with `/css`), and the `duyo-views` command. Installing it brings no dependencies; React and
React DOM are peers, and Remochi and Vite are optional peers, needed only for `@duyojs/duyo/remochi` and `@duyojs/duyo/views/vite`.

What is new in 1.1.0 is the Onyx pack. The rest is the 1.0.0 libraries, with these fixes:

- The packages work in an app that has not turned on the automatic JSX runtime: each `.tsx` file says it uses it.
- The generated kind types no longer import what they do not use, so the package compiles under `noUnusedLocals`.

See the repository's [CHANGELOG.md](https://github.com/achunt2143/duyo/blob/main/CHANGELOG.md) for everything in 1.1.0.
