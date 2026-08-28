// src/src/ErrorBoundary.jsx
import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ThermalSight Unhandled UI Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    try {
      localStorage.removeItem('thermalsight_draft');
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#0d0d0f',
          color: '#e8e8f0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'Segoe UI, system-ui, sans-serif'
        }}>
          <div style={{
            maxWidth: '580px',
            width: '100%',
            background: '#141418',
            border: '1px solid #ff4444',
            borderRadius: '10px',
            padding: '28px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '42px', marginBottom: '12px' }}>⚠️</div>
            <h2 style={{ fontSize: '20px', color: '#ff6b35', marginBottom: '8px' }}>
              ThermalSight Recovered from a Rendering Issue
            </h2>
            <p style={{ color: '#a0a0b8', fontSize: '13px', lineHeight: '1.6', marginBottom: '16px' }}>
              An unexpected render exception was caught safely. Click below to reload or reset the session cache.
            </p>
            <div style={{
              background: '#0d0d0f',
              border: '1px solid #2e2e3a',
              borderRadius: '6px',
              padding: '12px',
              textAlign: 'left',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: '#ffd54f',
              maxHeight: '140px',
              overflowY: 'auto',
              marginBottom: '20px',
              whiteSpace: 'pre-wrap'
            }}>
              {this.state.error?.toString()}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                style={{
                  background: '#ff6b35',
                  color: '#fff',
                  border: 'none',
                  padding: '9px 20px',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
                onClick={() => window.location.reload()}
              >
                🔄 Reload App
              </button>
              <button
                style={{
                  background: '#252530',
                  color: '#e8e8f0',
                  border: '1px solid #3e3e50',
                  padding: '9px 20px',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
                onClick={this.handleReset}
              >
                🗑 Clear Cache & Reset
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
