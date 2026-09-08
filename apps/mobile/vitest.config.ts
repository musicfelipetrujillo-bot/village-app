import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const src = resolve(dirname(fileURLToPath(import.meta.url)), 'src');

export default defineConfig({
  test: {
    // Widened from `src/utils/**` (test coverage plan, tier 4). The old glob
    // meant a test could only exist for a pure helper, which quietly decided
    // WHAT was testable: anything under lib/, api/ or store/ was out of reach
    // no matter how much consequence it carried.
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Pinned: these tests exist to prove local-vs-UTC day grouping. Under
    // TZ=UTC they cannot fail on the very bug they guard.
    env: { TZ: 'America/New_York' },
  },
  // Mirrors the tsconfig `paths` so tests can import modules the app's own way.
  // Without this, anything importing `@/lib/supabase` is untestable.
  resolve: {
    alias: {
      '@components': resolve(src, 'components'),
      '@screens': resolve(src, 'screens'),
      '@store': resolve(src, 'store'),
      '@hooks': resolve(src, 'hooks'),
      '@utils': resolve(src, 'utils'),
      '@api': resolve(src, 'api'),
      '@': src,
    },
  },
});
