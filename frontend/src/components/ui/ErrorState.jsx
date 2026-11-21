import React from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

const ErrorState = ({ title = "Something went wrong", description, onRetry, compact = false }) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center w-full ${compact ? 'py-6' : 'py-12 md:py-16'} px-4 bg-red-50/50 rounded-xl border border-red-100`}>
      <AlertCircle size={compact ? 24 : 32} className="text-red-400 mb-3" strokeWidth={1.5} />
      <h3 className={`font-bold text-red-800 ${compact ? 'text-sm mb-1' : 'text-base mb-2'}`}>
        {title}
      </h3>
      <p className={`text-red-600/80 max-w-md ${compact ? 'text-xs' : 'text-sm'} ${onRetry ? 'mb-5' : 'mb-0'}`}>
        {description || "We couldn't process this request right now."}
      </p>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          <RefreshCcw size={16} />
          Try Again
        </button>
      )}
    </div>
  );
};

export default ErrorState;
