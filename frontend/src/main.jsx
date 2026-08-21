/**
 * Application Main Entrypoint
 * 
 * Initializes the React DOM root, mounts React.StrictMode, and wraps the application
 * with TanStack QueryClientProvider for global server-state caching and synchronization.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'

// Configure global query caching defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevent jarring refetches when switching browser tabs
      retry: 1,                    // Limit retry attempts on failed network requests
    },
  },
})

// Mount application into the root DOM node
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)

