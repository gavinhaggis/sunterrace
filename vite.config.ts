import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // VITE_BASE is set by the GitHub Actions workflow to /<repo-name>/
  base: process.env.VITE_BASE ?? '/',
});
