"use client";

import { useEffect, useRef } from 'react';
import { FiAlertTriangle, FiInfo, FiAlertCircle } from 'react-icons/fi';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Handle Escape key and body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    
    // Focus the confirm button when opened for accessibility
    setTimeout(() => {
      confirmButtonRef.current?.focus();
    }, 50);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  // Visual variants for icons and buttons
  const variants = {
    danger: {
      icon: <FiAlertTriangle className="text-red-400" size={24} />,
      iconBg: 'bg-red-500/10 border-red-500/20',
      button: 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30',
    },
    warning: {
      icon: <FiAlertCircle className="text-amber-400" size={24} />,
      iconBg: 'bg-amber-500/10 border-amber-500/20',
      button: 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30',
    },
    info: {
      icon: <FiInfo className="text-blue-400" size={24} />,
      iconBg: 'bg-blue-500/10 border-blue-500/20',
      button: 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30',
    },
  };

  const currentVariant = variants[variant];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[100] bg-[#000c24]/80 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        <div 
          className="w-full max-w-md bg-[#00153A] border border-white/10 rounded-xl shadow-2xl pointer-events-auto transform transition-all scale-100 opacity-100"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          aria-describedby="dialog-description"
        >
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className={`shrink-0 flex items-center justify-center w-12 h-12 rounded-full border ${currentVariant.iconBg}`}>
                {currentVariant.icon}
              </div>
              
              <div className="flex-1 mt-1">
                <h3 id="dialog-title" className="text-lg font-medium text-white">
                  {title}
                </h3>
                <p id="dialog-description" className="mt-2 text-sm text-white/70 leading-relaxed">
                  {message}
                </p>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-white/70 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                ref={confirmButtonRef}
                onClick={() => {
                  onConfirm();
                  onCancel(); // auto-close after confirm, or let parent handle it if they want loading state, but typically we close it immediately or let parent unmount. 
                  // Wait, parent sets isOpen=false in onConfirm usually. Just firing onConfirm is enough.
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#00153A] focus:ring-${variant === 'danger' ? 'red' : variant === 'warning' ? 'amber' : 'blue'}-500/50 ${currentVariant.button}`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
