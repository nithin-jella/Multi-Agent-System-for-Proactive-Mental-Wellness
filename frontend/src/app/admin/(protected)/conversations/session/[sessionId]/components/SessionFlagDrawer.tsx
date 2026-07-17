import React from "react";

import { Button } from "@/components/ui/Button";
import { FiAlertTriangle as FlagIcon } from "@/icons";

interface SessionFlagDrawerProps {
  isOpen: boolean;
  shortId: string;
  editingFlagId: number | null;
  activeFlagId: number | null;
  flagStatus: string;
  flagReason: string;
  flagTags: string;
  flagNotes: string;
  onClose: () => void;
  onSubmit: () => void;
  onFlagStatusChange: (status: string) => void;
  onFlagReasonChange: (reason: string) => void;
  onFlagTagsChange: (tags: string) => void;
  onFlagNotesChange: (notes: string) => void;
}

export function SessionFlagDrawer({
  isOpen,
  shortId,
  editingFlagId,
  activeFlagId,
  flagStatus,
  flagReason,
  flagTags,
  flagNotes,
  onClose,
  onSubmit,
  onFlagStatusChange,
  onFlagReasonChange,
  onFlagTagsChange,
  onFlagNotesChange,
}: SessionFlagDrawerProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full sm:w-105 bg-[#000c24] border-l border-white/10 shadow-xl">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <FlagIcon className="h-4 w-4 text-yellow-400" />
            {editingFlagId ? "Edit Flag" : "New Flag"} ...{shortId}
          </h3>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label htmlFor="flag-status" className="block text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5">Status</label>
            <select
              id="flag-status"
              value={flagStatus}
              onChange={(e) => onFlagStatusChange(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/50"
            >
              <option value="open" className="bg-[#001a47]">Open</option>
              <option value="resolved" className="bg-[#001a47]">Resolved</option>
              <option value="ignored" className="bg-[#001a47]">Ignored</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5">Reason</label>
            <textarea
              value={flagReason}
              onChange={(e) => onFlagReasonChange(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/50 resize-none"
              placeholder="Why is this session flagged?"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5">Tags</label>
            <input
              value={flagTags}
              onChange={(e) => onFlagTagsChange(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/50"
              placeholder="crisis, escalation, urgent..."
            />
            {flagTags && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {flagTags.split(",").map((t) => t.trim()).filter(Boolean).map((t, i) => (
                  <span key={`${t}-${i}`} className="px-2 py-0.5 rounded text-[10px] border border-white/10 bg-white/5 text-white/50">{t}</span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5">Notes</label>
            <textarea
              value={flagNotes}
              onChange={(e) => onFlagNotesChange(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/50 resize-none"
              placeholder="Internal notes..."
            />
          </div>
        </div>
        <div className="p-5 border-t border-white/10 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSubmit}>{editingFlagId || activeFlagId ? "Save Changes" : "Create Flag"}</Button>
        </div>
      </div>
    </div>
  );
}
