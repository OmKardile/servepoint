import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      // Otherwise, watch only the src/ directory to avoid sandbox infra (skills, mini-services,
      // tests, upload, examples, download) from triggering spurious reloads / dependency scans.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: [
          '**/skills/**',
          '**/mini-services/**',
          '**/tests/**',
          '**/upload/**',
          '**/examples/**',
          '**/download/**',
          '**/node_modules/**',
          '**/.git/**',
        ],
      },
    },
    // Sandbox-specific: exclude non-app directories from the dependency pre-bundler.
    // The `skills/` folder contains sandbox reference HTML that imports `three`, which
    // is not part of this app and would otherwise break Vite's dependency scan.
    optimizeDeps: {
      exclude: ['skills', 'mini-services', 'tests', 'upload', 'examples', 'download'],
      entries: ['src/**/*.tsx', 'src/**/*.ts'],
    },
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/recharts')) {
              return 'vendor-charts';
            }
            if (id.includes('node_modules/@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('node_modules/lucide-react') || id.includes('node_modules/canvas-confetti')) {
              return 'vendor-icons';
            }
            if (id.includes('node_modules/zustand') || id.includes('node_modules/motion')) {
              return 'vendor-lib';
            }
          },
        },
      },
    },
  };
});
