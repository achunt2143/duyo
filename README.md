# Duyo

**Classic Enyo 1.x apps. Modern web tooling.**

Duyo is a modern runtime and developer toolchain for building applications in the classic Enyo 1.x programming style. It preserves the original `enyo.kind` / `components` authoring model while adding contemporary packaging, build tooling, and developer experience on top — bringing Enyo-style component development into the Node era without changing how apps are written.

---

## Goals

- Preserve the classic Enyo 1.x code style exactly as-is
- Provide a modern npm-based package and build system
- Enable Enyo apps to run in modern browsers without legacy bootstrapping
- Serve as the native component framework for [Pyxis](https://github.com/achunt2143), while remaining usable as a standalone framework
- Lay the groundwork for a full developer toolchain (`create-duyo`, Vite plugin, VS Code extension)

---

## Project Structure

```
duyo/
├── packages/
│   ├── runtime/        # Enyo 1.0 source (see attribution below)
│   ├── vite-plugin/    # Vite integration (coming soon)
│   └── create-duyo/    # App scaffolding CLI (coming soon)
├── examples/           # Example apps
└── README.md
```

---

## Attribution

The `packages/runtime` directory contains the **Enyo 1.0 JavaScript Application Framework**, originally developed by Palm, Inc. and released as open source by HP.

> *Enyo 1.0 was distributed with HP webOS 2.2 and 3.0. This version corresponds with Enyo 1.0 submission 128 that shipped on HP webOS 3.0.5 in January 2012.*

Original source: [https://github.com/enyojs/enyo-1.0](https://github.com/enyojs/enyo-1.0)

Enyo 1.0 is released under the **Apache License, Version 2.0**. See [`packages/runtime/LICENSE-2.0.txt`](packages/runtime/LICENSE-2.0.txt) for the full license text.

---

## License

Duyo (tooling, wrappers, and original code in this repository outside of `packages/runtime`) is licensed under the **Apache License, Version 2.0**.

The Enyo 1.0 runtime in `packages/runtime` retains its original Apache 2.0 license as attributed above.

```
Copyright 2026 achunt2143

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
