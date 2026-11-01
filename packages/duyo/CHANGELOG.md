# Changelog

## 1.1.0

First release as one package: `duyo`. It holds what were the libraries of this repository, now its imports:
`duyo` (the core), `duyo/layout`, `duyo/react`, `duyo/views` (with `spec`, `load` and `vite`), `duyo/remochi`
and `duyo/onyx` (each with `/css`), and the `duyo-views` command. Installing it brings no dependencies; React and
React DOM are peers, and Remochi and Vite are optional peers, needed only for `duyo/remochi` and `duyo/views/vite`.

What is new in 1.1.0 is the Onyx pack. The rest is the 1.0.0 libraries, with these fixes:

- The packages work in an app that has not turned on the automatic JSX runtime: each `.tsx` file says it uses it.
- The generated kind types no longer import what they do not use, so the package compiles under `noUnusedLocals`.

See the repository's [CHANGELOG.md](https://github.com/achunt2143/duyo/blob/main/CHANGELOG.md) for everything in 1.1.0.
