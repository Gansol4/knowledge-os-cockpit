import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// Em produção o Cockpit fica em https://<utilizador>.github.io/knowledge-os-cockpit/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/knowledge-os-cockpit/' : '/',
}))
