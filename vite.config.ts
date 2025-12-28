
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // 確保在前端代碼中可以透過 process.env 訪問變數 (Azure 注入)
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  },
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
});
