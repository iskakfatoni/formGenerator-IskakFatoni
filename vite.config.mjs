import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        form: resolve(__dirname, 'form.html'),
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep informative warnings
        drop_debugger: true,
      },
      format: {
        comments: false,
      },
      mangle: {
        toplevel: false, // Keep global constructors visible for inter-script compatibility
      },
    },
  },
});
