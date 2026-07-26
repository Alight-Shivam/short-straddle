import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // Pure-function formulas tests don't need a DOM; switch a specific file to
    // jsdom via a per-file `// @vitest-environment jsdom` comment if a future
    // test needs to render a component.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
