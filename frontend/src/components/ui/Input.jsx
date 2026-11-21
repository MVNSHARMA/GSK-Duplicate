import React, { forwardRef, useId } from 'react';

const Input = forwardRef(({
  label,
  error,
  helperText,
  required = false,
  className = '',
  containerClassName = '',
  id: providedId,
  ...props
}, ref) => {
  const generatedId = useId();
  const id = providedId || generatedId;
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;

  const ariaDescribedBy = [
    error ? errorId : null,
    helperText ? helperId : null
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`w-full flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <input
        ref={ref}
        id={id}
        required={required}
        aria-invalid={!!error}
        aria-describedby={ariaDescribedBy}
        className={`
          w-full px-4 py-2.5 bg-white border rounded-lg text-sm transition-colors text-dark placeholder:text-gray-400
          focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
          ${error 
            ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' 
            : 'border-gray-200 hover:border-gray-300 focus:border-primary focus:ring-primary/20'}
          ${className}
        `}
        {...props}
      />
      
      {error && (
        <p id={errorId} className="text-xs text-red-600 mt-0.5">
          {error}
        </p>
      )}
      
      {helperText && !error && (
        <p id={helperId} className="text-xs text-gray-500 mt-0.5">
          {helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
