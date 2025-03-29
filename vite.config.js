import { defineConfig } from 'vite';
import postcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  css: {
    postcss: {
      plugins: [postcss(), autoprefixer()],
    },
  },
});
