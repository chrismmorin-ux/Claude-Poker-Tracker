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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PokerTrackerWireframes />
  </React.StrictMode>,
)
