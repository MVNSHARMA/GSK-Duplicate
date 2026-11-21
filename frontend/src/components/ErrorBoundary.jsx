import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // We log it silently in the background for development.
    // In a real production setup, this would ping Sentry or LogRocket.
    console.error("ErrorBoundary caught a rendering error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-gray-100 p-8 text-center relative overflow-hidden">
            {/* Top Accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-red-500"></div>
            
            <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-500 w-10 h-10" />
            </div>
            
            <h1 className="text-2xl font-bold font-heading text-slate-800 mb-3">
              Something went wrong
            </h1>
            
            <p className="text-slate-600 mb-8 leading-relaxed">
              We encountered an unexpected error while displaying this page. 
              Please try reloading the application. If the problem persists, 
              contact support.
            </p>
            
            <button 
              onClick={this.handleReload}
              className="flex items-center justify-center w-full gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-primary/20"
            >
              <RefreshCcw size={18} />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
