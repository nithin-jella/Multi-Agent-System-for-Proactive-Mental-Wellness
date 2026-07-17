
// src/components/features/chat/ModelSelector.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModelOption {
  value: string;
  label: string;
}

interface ModelSelectorProps {
  model: string;
  setModel: (model: string) => void;
  options: ModelOption[];
  className?: string;
}

export default function ModelSelector({ model, setModel, options, className }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find(opt => opt.value === model);

  const handleSelect = (value: string) => {
    setModel(value);
    setIsOpen(false);
  };

  const dropdownVariants: Variants = {
    hidden: { opacity: 0, y: -10, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2, ease: 'easeOut' } },
    exit: { opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.15, ease: 'easeIn' } },
  };

  return (
    <div className={cn("relative inline-block w-full text-left sm:w-auto", className)}>
      {/* Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-white sm:w-56",
          "bg-white/10 backdrop-blur-md border border-white/20 rounded-lg shadow-sm",
          "hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-ugm-gold/50"
        )}
      >
        <span>{selectedOption ? selectedOption.label : 'Select Model'}</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 ml-2 transition-transform duration-200",
            isOpen && "transform rotate-180"
          )}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              "absolute right-0 mt-2 w-full origin-top-right overflow-hidden sm:w-56",
              "bg-black/50 backdrop-blur-xl border border-white/10 rounded-lg shadow-lg z-20"
            )}
          >
            <ul className="py-1">
              {options.map((option) => (
                <li key={option.value}>
                  <button
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2 text-sm text-left",
                      "text-white hover:bg-white/10 transition-colors"
                    )}
                  >
                    <span>{option.label}</span>
                    {model === option.value && <Check className="w-4 h-4 text-ugm-gold" />}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
