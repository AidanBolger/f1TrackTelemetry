import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Base path for GitHub Pages (project site). Change if you host under a different repo/user.
  base: '/f1TrackTelemetry/',
  plugins: [react()],
})
