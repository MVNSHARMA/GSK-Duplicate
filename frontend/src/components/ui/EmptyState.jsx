import React from 'react';
import { PackageOpen } from 'lucide-react';

const EmptyState = ({ icon: Icon = PackageOpen, title, description, action, actionLabel, compact = false }) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center w-full ${compact ? 'py-8' : 'py-16 md:py-24'} px-4 bg-white rounded-xl border border-dashed border-gray-200`}>
      <div className={`flex items-center justify-center ${compact ? 'w-12 h-12 mb-3' : 'w-16 h-16 mb-4'} rounded-full bg-gray-50 text-gray-400`}>
        <Icon size={compact ? 24 : 32} strokeWidth={1.5} />
      </div>
      <h3 className={`font-bold text-dark ${compact ? 'text-base mb-1' : 'text-lg mb-2'}`}>
        {title}
      </h3>
      <p className={`text-gray-500 max-w-sm ${compact ? 'text-xs' : 'text-sm'} ${action ? 'mb-6' : 'mb-0'}`}>
        {description}
      </p>
      {action && actionLabel && (
        <button 
          onClick={action}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
