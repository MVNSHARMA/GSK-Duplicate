import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  maxWidth = 'max-w-2xl',
  hideClose = false 
}) => {
  const overlayRef = useRef(null);
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
      document.body.style.overflow = 'hidden';
      
      // Focus the modal content for screen readers
      if (modalRef.current) {
        modalRef.current.focus();
      }
    } else {
      document.body.style.overflow = '';
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !hideClose) {
        onClose();
      }
    };
    
    // Focus trapping could be implemented here if required, but native focus handles decent trapping in modern browsers
    // For now, ensuring Escape works and scrolling is disabled is the priority.
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, hideClose]);

  if (!isOpen) return null;

  const content = (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div 
        ref={overlayRef}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={() => !hideClose && onClose()}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div 
        ref={modalRef}
        tabIndex={-1}
        className={`relative w-full ${maxWidth} bg-white rounded-2xl shadow-2xl flex flex-col max-h-full overflow-hidden outline-none animate-in fade-in zoom-in-95 duration-200`}
      >
        {/* Header */}
        {title && (
          <div className="flex-shrink-0 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 id="modal-title" className="text-xl font-bold text-dark">
              {title}
            </h2>
            {!hideClose && (
              <button 
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1 p-6">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default Modal;
