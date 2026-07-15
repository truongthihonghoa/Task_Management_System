import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'Arial, sans-serif', color: '#2D1B4E' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Frontend render error</h1>
          <p style={{ color: '#4B5563', marginBottom: 12 }}>
            The UI could not render. Open the browser console for the full stack trace.
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#F3F4F6', padding: 16, borderRadius: 8 }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
        </div>
      )
    }

    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>,
)
