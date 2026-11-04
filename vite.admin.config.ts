import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const studentLib = path.resolve(__dirname, 'src/lib');

// The AI, file-reading and library code in src/lib is shared with the Mini App. It reaches Supabase
// through "./supabase", which there is the student client. Here that import must be the admin
// client, so every call carries the admin's own session.
const useAdminSupabaseClient = (): Plugin => ({
  name: 'use-admin-supabase-client',
  enforce: 'pre',
  resolveId(source, importer) {
    if (source === './supabase' && importer && path.resolve(importer).startsWith(studentLib)) {
      return path.resolve(__dirname, 'admin/src/lib/supabase.ts');
    }
  },
});

// The admin site is a separate app (admin/) built to dist-admin and deployed on its own,
// so none of its code ships inside the student Mini App.
export default defineConfig({
  root: 'admin',
  envDir: '..',
  plugins: [useAdminSupabaseClient(), react()],
  css: { postcss: path.resolve(__dirname) },
  build: {
    outDir: '../dist-admin',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: { port: 5174 },
});
