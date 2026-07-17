import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiEdit, FiMoreHorizontal, FiEye, FiExternalLink, FiBarChart2, FiTrash2, FiToggleLeft, FiToggleRight } from 'react-icons/fi';

export interface SurveyRowActionsProps {
  isActive: boolean;
  onToggleActive: () => void;
  onEdit: () => void;
  onViewResponses: () => void;
  onOpenFullEditor: () => void;
  onAnalytics: () => void;
  onDelete: () => void;
  disabled?: boolean;
  hideToggle?: boolean; // allows placing toggle separately
}

// Simple utility to join classes
const cx = (...cls: (string | false | null | undefined)[]) => cls.filter(Boolean).join(' ');

export const SurveyRowActions: React.FC<SurveyRowActionsProps> = ({
  isActive,
  onToggleActive,
  onEdit,
  onViewResponses,
  onOpenFullEditor,
  onAnalytics,
  onDelete,
  disabled = false,
  hideToggle = false,
}) => {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const focusIndexRef = useRef(0);

  const items: Array<{ label: string; action: () => void; icon: React.ReactNode; danger?: boolean; confirm?: boolean }>= [
    { label: 'View Responses', action: onViewResponses, icon: <FiEye className="h-4 w-4" /> },
    { label: 'Open Full Editor', action: onOpenFullEditor, icon: <FiExternalLink className="h-4 w-4" /> },
    { label: 'Analytics', action: onAnalytics, icon: <FiBarChart2 className="h-4 w-4" /> },
    confirmDelete
      ? { label: 'Confirm Delete', action: () => { onDelete(); setConfirmDelete(false); }, icon: <FiTrash2 className="h-4 w-4" />, danger: true, confirm: true }
      : { label: 'Delete', action: () => { setConfirmDelete(true); }, icon: <FiTrash2 className="h-4 w-4" />, danger: true },
  ];

  const closeMenu = useCallback(() => { setOpen(false); }, []);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(e.target as Node) || triggerRef.current?.contains(e.target as Node)) return;
      closeMenu();
    };
    document.addEventListener('mousedown', handleClick, true);
    return () => document.removeEventListener('mousedown', handleClick, true);
  }, [open, closeMenu]);

  // Keyboard navigation inside menu
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu();
        triggerRef.current?.focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        const next = (focusIndexRef.current + dir + items.length) % items.length;
        focusIndexRef.current = next;
        const el = menuRef.current?.querySelectorAll<HTMLButtonElement>('[data-menu-item]')[next];
        el?.focus();
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [open, closeMenu, items.length]);

  useEffect(() => {
    if (open) {
      // Focus first item when menu opens
      requestAnimationFrame(() => {
        focusIndexRef.current = 0;
        const el = menuRef.current?.querySelectorAll<HTMLButtonElement>('[data-menu-item]')[0];
        el?.focus();
      });
    }
  }, [open]);

  const handleItemActivate = (action: () => void) => {
    action();
    // Keep menu open if entering confirm state
    if (!confirmDelete) closeMenu();
  };

  return (
    <div className="flex items-center gap-2">
      {!hideToggle && (
        <button
          type="button"
          onClick={onToggleActive}
          disabled={disabled}
          className={cx('inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#FFCA40]/60 focus:ring-offset-[#1c1f26]',
            isActive
              ? 'bg-green-700/25 border-green-500/50 text-green-200 hover:bg-green-700/35'
              : 'bg-gray-700/25 border-gray-500/50 text-gray-300 hover:bg-gray-700/35',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          data-state={isActive ? 'on' : 'off'}
        >
          {isActive ? <FiToggleRight className="h-4 w-4" /> : <FiToggleLeft className="h-4 w-4" />}
          <span className="hidden md:inline">{isActive ? 'Active' : 'Inactive'}</span>
          <span className="sr-only">Survey is currently {isActive ? 'active' : 'inactive'}</span>
        </button>
      )}
      <button
        type="button"
        onClick={onEdit}
        disabled={disabled}
        className={cx('inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-blue-500/40 text-blue-300 bg-blue-700/25 hover:bg-blue-700/35 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#FFCA40]/60 focus:ring-offset-[#1c1f26]', disabled && 'opacity-50 cursor-not-allowed')}
        aria-label="Edit survey"
      >
        <FiEdit className="h-4 w-4" />
        <span className="hidden md:inline">Edit</span>
      </button>
      <div className="relative">
        <button
          type="button"
            ref={triggerRef}
          onClick={() => setOpen(o => !o)}
          disabled={disabled}
          aria-haspopup="menu"
          className={cx('inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-white/25 text-white bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#FFCA40]/60 focus:ring-offset-[#1c1f26]', disabled && 'opacity-50 cursor-not-allowed')}
        >
          <FiMoreHorizontal className="h-4 w-4" />
          <span className="hidden md:inline">More</span>
        </button>
        <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            aria-label="More survey actions"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="absolute right-0 mt-2 w-48 rounded-md border border-white/20 bg-[#1c1f26] shadow-lg p-1 z-50 origin-top-right"
          >
            <div role="menu" aria-orientation="vertical">
              {items.map((item, idx) => (
                <button
                  key={item.label}
                  role="menuitem"
                  data-menu-item
                  type="button"
                  tabIndex={idx === 0 ? 0 : -1}
                  onClick={() => handleItemActivate(item.action)}
                  className={cx('w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/40', item.danger
                    ? item.confirm ? 'text-red-100 bg-red-600/30 hover:bg-red-600/40 focus:bg-red-600/40 border border-red-500/40'
                      : 'text-red-300 hover:bg-red-600/25 focus:bg-red-600/25'
                    : 'text-gray-200 hover:bg-white/15 focus:bg-white/15')}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
            {confirmDelete && (
              <div className="px-2 pt-1 pb-2 text-[10px] text-red-300">Click Confirm Delete to proceed</div>
            )}
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
};

SurveyRowActions.displayName = 'SurveyRowActions';

export default SurveyRowActions;