import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/themes/themes.css'
import './styles/base/base.css'
import App from './App.jsx'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './queryClient.ts'

// Put the saved color scheme back on the page (same as theme.js did)
document.documentElement.setAttribute('data-theme', localStorage.getItem('siteTheme') || 'default');
document.documentElement.setAttribute('data-background', localStorage.getItem('siteBackground') || 'default');
document.documentElement.setAttribute('data-display', localStorage.getItem('siteDisplay') || 'standard');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
