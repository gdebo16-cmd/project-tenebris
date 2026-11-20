import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
// Ports come from the root .env, so each worktree (one per AI) can run its own copy:
// PORT = Express server (default 4000), WEB_PORT = this Vite server (default 5173).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../..', '');
  const api = `http://localhost:${env.PORT || 4000}`;
  return {
  plugins: [react()],
  publicDir: '../../assets', // one image home, shared with the server build
  server: {
    host: true, // also listen on the Wi-Fi address so a phone can open it
    port: Number(env.WEB_PORT) || 5173,
    strictPort: true, // fail loudly instead of silently taking another worktree's port
    // Anything starting with these paths is passed to Express (PORT in .env)
    proxy: {
      '/api': api,
      '/socket.io': { target: api, ws: true },
    },
  },
  };
});
