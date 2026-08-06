import "@testing-library/jest-dom/vitest";

// Hermetic server-rotation config (src/lib/server-rotation.ts). The Cosmic
// Signature production default is a two-server rotation list (a1/a2), which
// would make URL-building assertions depend on the wall-clock hour; tests pin
// a single fixture host instead. Plural lists are removed so shell-exported
// deployment values cannot leak into the suite. Tests that exercise rotation
// stub their own lists and call __resetServerRotation().
process.env.COSMIC_SIGNATURE_API_URL = "https://nfts.cosmicsignature.com";
delete process.env.COSMIC_SIGNATURE_API_URLS;
delete process.env.NEXT_PUBLIC_COSMIC_SIGNATURE_API_URLS;
delete process.env.NEXT_PUBLIC_COSMIC_SIGNATURE_API_URL;
delete process.env.RANDOM_WALK_API_URLS;
delete process.env.NEXT_PUBLIC_RANDOM_WALK_API_URLS;
delete process.env.RANDOM_WALK_API_URL;
delete process.env.NEXT_PUBLIC_RANDOM_WALK_API_URL;
delete process.env.ARBITRUM_RPC_URLS;
delete process.env.NEXT_PUBLIC_ARBITRUM_RPC_URLS;
delete process.env.ARBITRUM_RPC_URL;
delete process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL;

type ObserverRecord = {
  callback: IntersectionObserverCallback;
  observer: IntersectionObserver;
  elements: Set<Element>;
};

const intersectionObservers = new Set<ObserverRecord>();

class IntersectionObserverMock implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds = [];
  private readonly record: ObserverRecord;

  constructor(callback: IntersectionObserverCallback) {
    this.record = { callback, observer: this, elements: new Set() };
    intersectionObservers.add(this.record);
  }

  disconnect() {
    intersectionObservers.delete(this.record);
  }

  observe(element: Element) {
    this.record.elements.add(element);
  }

  takeRecords() {
    return [];
  }

  unobserve(element: Element) {
    this.record.elements.delete(element);
  }
}

global.IntersectionObserver =
  IntersectionObserverMock as unknown as typeof IntersectionObserver;

// jsdom does not implement <dialog> modal behavior yet. (Guarded for suites
// that run in a plain node environment.)
if (
  typeof HTMLDialogElement !== "undefined" &&
  typeof HTMLDialogElement.prototype.showModal !== "function"
) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
}
if (
  typeof HTMLDialogElement !== "undefined" &&
  typeof HTMLDialogElement.prototype.close !== "function"
) {
  HTMLDialogElement.prototype.close = function close() {
    if (!this.open) {
      return;
    }

    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}

/**
 * Fires every live IntersectionObserver with the given intersection state so
 * tests can simulate elements scrolling into view.
 */
export function triggerIntersectionObservers(isIntersecting: boolean) {
  for (const record of [...intersectionObservers]) {
    const entries = [...record.elements].map(
      (target) =>
        ({ isIntersecting, target }) as unknown as IntersectionObserverEntry,
    );
    record.callback(entries, record.observer);
  }
}
