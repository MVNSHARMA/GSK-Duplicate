import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const Toast = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Small delay to allow CSS transition to trigger on mount
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const icons = {
    success: <CheckCircle className="text-green-500" size={20} />,
    error: <XCircle className="text-red-500" size={20} />,
    warning: <AlertTriangle className="text-amber-500" size={20} />,
    info: <Info className="text-blue-500" size={20} />
  };

  const borderColors = {
    success: 'border-green-500',
    error: 'border-red-500',
    warning: 'border-amber-500',
    info: 'border-blue-500'
  };

  return (
    <div 
      className={`bg-white rounded-lg shadow-lg border-l-4 ${borderColors[toast.type]} p-4 w-80 sm:w-96 pointer-events-auto transform transition-all duration-300 ease-out flex items-start gap-3
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}
      `}
      role="alert"
      aria-live="polite"
    >
      <div className="flex-shrink-0 mt-0.5">
        {icons[toast.type]}
      </div>
      <div className="flex-1 text-sm text-gray-700 break-words leading-relaxed">
        {toast.message}
      </div>
      <button 
        onClick={onClose}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Close"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default Toast;
