import React, { forwardRef } from 'react';
import { ButtonLoading } from './Skeleton';

const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  loading = false,
  disabled = false,
  className = '',
  icon: Icon,
  ...props
}, ref) => {
  
  const baseStyles = "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";
  
  const variants = {
    primary: "bg-primary text-white hover:bg-primary/90 focus:ring-primary border border-transparent shadow-sm",
    secondary: "bg-white text-gray-700 hover:bg-gray-50 focus:ring-primary border border-gray-300 shadow-sm",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-600 border border-transparent shadow-sm",
    outline: "bg-transparent text-primary hover:bg-primary/5 focus:ring-primary border border-primary",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100 hover:text-dark focus:ring-gray-400 border border-transparent",
    success: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-600 border border-transparent shadow-sm"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs rounded-md gap-1.5",
    md: "px-4 py-2.5 text-sm rounded-lg gap-2",
    lg: "px-6 py-3 text-base rounded-xl gap-2.5"
  };

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 20
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <ButtonLoading />
      ) : (
        Icon && <Icon size={iconSizes[size]} strokeWidth={2} className="flex-shrink-0" />
      )}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
export default Button;
