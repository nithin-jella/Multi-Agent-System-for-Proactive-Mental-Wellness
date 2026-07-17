"use client";

import React, { useState } from 'react';
import { FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import { exportJournalEntries } from '@/services/api';
import { toast } from 'react-hot-toast';

interface JournalExportButtonProps {
  className?: string;
}

export default function JournalExportButton({ className = '' }: JournalExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleExport = async (format: 'csv' | 'pdf') => {
    setIsExporting(true);
    setIsDropdownOpen(false);
    
    try {
      const blob = await exportJournalEntries(format);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      a.download = `journal_export_${timestamp}.${format}`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success(`Journal exported as ${format.toUpperCase()} successfully!`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(`Failed to export journal. Please try again.`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        disabled={isExporting}
        className="w-full px-4 py-2.5 bg-gradient-to-r from-[#FFCA40]/20 to-[#FFB700]/20 border border-[#FFCA40]/30 text-white rounded-xl hover:from-[#FFCA40]/30 hover:to-[#FFB700]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isExporting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#FFCA40]"></div>
            <span>Exporting...</span>
          </>
        ) : (
          <>
            <FiDownload className="text-[#FFCA40]" />
            <span>Export Journal</span>
          </>
        )}
      </button>

      {isDropdownOpen && !isExporting && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsDropdownOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl shadow-xl z-20 overflow-hidden">
            <button
              onClick={() => handleExport('csv')}
              className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors flex items-center gap-3 border-b border-white/10 last:border-b-0"
            >
              <FiFileText className="text-green-400" size={18} />
              <div>
                <div className="font-medium text-white">Export as CSV</div>
                <div className="text-xs text-white/50">Spreadsheet format</div>
              </div>
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors flex items-center gap-3"
            >
              <FiFile className="text-red-400" size={18} />
              <div>
                <div className="font-medium text-white">Export as PDF</div>
                <div className="text-xs text-white/50">Print-ready document</div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
