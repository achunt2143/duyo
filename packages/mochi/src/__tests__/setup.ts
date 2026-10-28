// jsdom has no layout or canvas. Remochi measures text on a canvas and observes sizes;
// these stubs stand in for the browser APIs, they do not model them.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;

HTMLCanvasElement.prototype.getContext = (() => ({
  font: '',
  measureText: (text: string) => ({ width: text.length * 8 }),
  fillRect() {},
  clearRect() {},
  beginPath() {},
  closePath() {},
  moveTo() {},
  lineTo() {},
  arc() {},
  fill() {},
  stroke() {},
  save() {},
  restore() {},
  scale() {},
  translate() {},
  rotate() {},
  drawImage() {},
  createLinearGradient: () => ({ addColorStop() {} }),
  createRadialGradient: () => ({ addColorStop() {} }),
  getImageData: () => ({ data: [] }),
  setTransform() {},
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

Element.prototype.scrollIntoView ??= () => {};

// Remochi's switch captures the pointer while dragging.
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
