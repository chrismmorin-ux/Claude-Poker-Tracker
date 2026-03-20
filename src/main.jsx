import React from 'react'
import ReactDOM from 'react-dom/client'
import PokerTrackerWireframes from './PokerTracker.jsx'
import './index.css'

// Dev-only: expose seed data helpers on window for console access
// Usage: window.__seedTestData() / window.__clearTestData()
// Range engine seed data: window.__seedRangeData() / window.__clearRangeData()
if (import.meta.env.DEV) {
  import('./utils/seedTestData')
  import('./utils/seedRangeTestData')
  import('./utils/handSimulator')
}

// PWA update listener — reload when new service worker activates
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then((registration) => {
    registration.addEventListener('controllerchange', () => {
      // New SW has taken control — reload to get fresh assets
      window.location.reload()
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PokerTrackerWireframes />
  </React.StrictMode>,
)
