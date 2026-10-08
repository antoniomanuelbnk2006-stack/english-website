import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Solo hay DOM en los tests que piden jsdom.
afterEach(() => {
  if (typeof document !== 'undefined') cleanup();
});
