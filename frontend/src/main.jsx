import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app.jsx'
import './styles.css'
import './club.css'
import './room-lobby.css'
import './growth.css'
import { FeedbackProvider } from './components/feedback.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <FeedbackProvider><App /></FeedbackProvider>
  </React.StrictMode>
)
