import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi
    .fn()
    .mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
});

const originalStyle = window.getComputedStyle;
window.getComputedStyle = (elt, pseudo) =>
  originalStyle.call(window, elt, pseudo ? undefined : pseudo);
