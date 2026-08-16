import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/utils/**/*.test.ts'],
    environment: 'node',
    // Pinned: these tests exist to prove local-vs-UTC day grouping. Under
    // TZ=UTC they cannot fail on the very bug they guard.
    env: { TZ: 'America/New_York' },
  },
});
