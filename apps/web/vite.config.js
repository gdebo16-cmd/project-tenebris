import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: '../../assets', // one image home, shared with the server build
  server: {
    host: true, // also listen on the Wi-Fi address so a phone can open it
    // Anything starting with these paths is passed to Express on port 4000
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
});
