"use client";

import { useEffect, useRef, useState } from 'react';

interface NoteInputDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  inputLabel: string;
  inputPlaceholder: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}

export default function NoteInputDialog({
  isOpen,
  title,
  message,
  inputLabel,
  inputPlaceholder,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: NoteInputDialogProps) {
  const [note, setNote] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setNote('');
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      document.body.style.overflow = '';
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const isConfirmDisabled = !note.trim();

  return (
    <>
      <div 
        className="fixed inset-0 z-[100] bg-[#000c24]/80 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
        aria-hidden="true"
      />

      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        <div 
          className="w-full max-w-md bg-[#00153A] border border-white/10 rounded-xl shadow-2xl pointer-events-auto transform transition-all scale-100 opacity-100"
          role="dialog"
          aria-modal="true"
        >
          <div className="p-6">
            <h3 className="text-lg font-medium text-white">{title}</h3>
            <p className="mt-2 text-sm text-white/70 leading-relaxed">
              {message}
            </p>

            <div className="mt-4">
              <label htmlFor="note-input" className="block text-sm font-medium text-white mb-2">
                {inputLabel}
              </label>
              <input
                ref={inputRef}
                id="note-input"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={inputPlaceholder}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/50 focus:border-[#FFCA40]/50 transition-all"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isConfirmDisabled) {
                    onConfirm(note);
                  }
                }}
              />
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
                onClick={() => onConfirm(note)}
                disabled={isConfirmDisabled}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[#FFCA40] text-[#001D58] hover:bg-[#FFCA40]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#00153A] focus:ring-[#FFCA40]/50"
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
