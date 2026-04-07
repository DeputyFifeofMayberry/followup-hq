import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { StatePanel } from './components/ui/AppPrimitives';
import './index.css';

interface RootErrorBoundaryState {
  error: Error | null;
}

class RootErrorBoundary extends React.Component<React.PropsWithChildren, RootErrorBoundaryState> {
  public state: RootErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application crash captured by RootErrorBoundary.', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 xl:px-8">
          <div className="mx-auto flex min-h-[80vh] max-w-[760px] items-center justify-center">
            <div className="w-full rounded-3xl border border-rose-200 bg-white p-6 shadow-sm">
              <StatePanel
                tone="error"
                title="SetPoint hit a runtime error"
                message="The app stopped rendering. Use the details below to fix the crash instead of getting a blank white page."
              />
              <pre className="mt-4 max-h-60 overflow-auto rounded-xl bg-slate-900 p-3 text-xs text-rose-100">
                {this.state.error.message}
              </pre>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Reload app
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>,
);

if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !('__TAURI_INTERNALS__' in window)) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}
