// jsdom has no layout. These stand in for browser APIs Onyx's controls call; they do not model them.
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
