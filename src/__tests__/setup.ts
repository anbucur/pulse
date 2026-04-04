/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  get length() {
    return Object.keys(this.store).length;
  },
  key: vi.fn(),
};

global.localStorage = localStorageMock as any;

// Mock fetch
global.fetch = vi.fn();

// Cleanup after each test
afterEach(() => {
  cleanup;
  vi.clearAllMocks();
});
