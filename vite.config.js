import { defineConfig } from 'vite';

export default defineConfig({
  // this base makes sure all my assets get the right path set because I'm sharing this app via GitHub Pages
  base: '/music-visualizer-web/',
  compilerOptions: {
    types: ['vite/client']
  },
  // https://github.com/vitejs/vite/issues/4953
  assetsInclude: ['**/*.gltf'],
});
