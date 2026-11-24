import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    chunkSizeWarningLimit: 850,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-three-core',
              test: /node_modules[\\/]three[\\/]/,
            },
            {
              name: 'vendor-r3f',
              test: /node_modules[\\/](@react-three|troika|three-stdlib|maath|suspend-react)/,
            },
            {
              name: 'vendor-audio',
              test: /node_modules[\\/](tone|standardized-audio-context)/,
            },
            {
              name: 'vendor-react',
              test: /node_modules[\\/](react|react-dom|scheduler|lucide-react)/,
            },
          ],
        },
      },
    },
  },
});
