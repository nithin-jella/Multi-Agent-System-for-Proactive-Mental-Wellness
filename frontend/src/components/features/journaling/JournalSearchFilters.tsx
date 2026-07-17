"use client";

import React, { useState, useEffect } from 'react';
import { FiSearch, FiFilter, FiX, FiCalendar, FiTag } from 'react-icons/fi';
import { searchJournalEntries, getAllUserTags } from '@/services/api';
import type { JournalEntryItem } from '@/types/api';

interface JournalSearchFiltersProps {
  onResults: (entries: JournalEntryItem[]) => void;
  onLoadingChange: (loading: boolean) => void;
  className?: string;
}

interface Filters {
  searchQuery: string;
  valenceMin: number | null;
  valenceMax: number | null;
  arousalMin: number | null;
  arousalMax: number | null;
  dominanceMin: number | null;
  dominanceMax: number | null;
  selectedTags: string[];
  dateFrom: string;
  dateTo: string;
}

export default function JournalSearchFilters({ 
  onResults, 
  onLoadingChange,
  className = '' 
}: JournalSearchFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  
  const [filters, setFilters] = useState<Filters>({
    searchQuery: '',
    valenceMin: null,
    valenceMax: null,
    arousalMin: null,
    arousalMax: null,
    dominanceMin: null,
    dominanceMax: null,
    selectedTags: [],
    dateFrom: '',
    dateTo: '',
  });

  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  useEffect(() => {
    fetchAllTags();
  }, []);

  useEffect(() => {
    let count = 0;
    if (filters.searchQuery) count++;
    if (filters.valenceMin !== null || filters.valenceMax !== null) count++;
    if (filters.arousalMin !== null || filters.arousalMax !== null) count++;
    if (filters.dominanceMin !== null || filters.dominanceMax !== null) count++;
    if (filters.selectedTags.length > 0) count++;
    if (filters.dateFrom || filters.dateTo) count++;
    setActiveFiltersCount(count);
  }, [filters]);

  const fetchAllTags = async () => {
    setIsLoadingTags(true);
    try {
      const tags = await getAllUserTags();
      setAllTags(tags);
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setIsLoadingTags(false);
    }
  };

  const handleSearch = async () => {
    onLoadingChange(true);
    try {
      const results = await searchJournalEntries({
        search_query: filters.searchQuery || undefined,
        valence_min: filters.valenceMin ?? undefined,
        valence_max: filters.valenceMax ?? undefined,
        arousal_min: filters.arousalMin ?? undefined,
        arousal_max: filters.arousalMax ?? undefined,
        inferred_dominance_min: filters.dominanceMin ?? undefined,
        inferred_dominance_max: filters.dominanceMax ?? undefined,
        tags: filters.selectedTags.length > 0 ? filters.selectedTags : undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
      });
      onResults(results);
    } catch (error) {
      console.error('Error searching entries:', error);
      onResults([]);
    } finally {
      onLoadingChange(false);
    }
  };

  const handleClearFilters = () => {
    setFilters({
      searchQuery: '',
      valenceMin: null,
      valenceMax: null,
      arousalMin: null,
      arousalMax: null,
      dominanceMin: null,
      dominanceMax: null,
      selectedTags: [],
      dateFrom: '',
      dateTo: '',
    });
    onResults([]);
  };

  const setPadFilterValue = (
    field:
      | 'valenceMin'
      | 'valenceMax'
      | 'arousalMin'
      | 'arousalMax'
      | 'dominanceMin'
      | 'dominanceMax',
    rawValue: string,
  ) => {
    if (rawValue === '') {
      setFilters((prev) => ({ ...prev, [field]: null }));
      return;
    }

    const parsed = Number.parseFloat(rawValue);
    if (Number.isNaN(parsed)) {
      return;
    }

    const clipped = Math.max(-1, Math.min(1, parsed));
    setFilters((prev) => ({ ...prev, [field]: clipped }));
  };

  const toggleTag = (tag: string) => {
    setFilters(prev => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tag)
        ? prev.selectedTags.filter(t => t !== tag)
        : [...prev.selectedTags, tag]
    }));
  };

  return (
    <div className={`bg-white/3 backdrop-blur-xl rounded-2xl border border-white/10 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
            <input
              type="text"
              placeholder="Search entries by content..."
              value={filters.searchQuery}
              onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#FFCA40] focus:border-transparent transition"
            />
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="relative px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition flex items-center gap-2"
          >
            <FiFilter />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-[#FFCA40] text-[#001D58] text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
          <button
            onClick={handleSearch}
            className="px-6 py-2.5 bg-linear-to-r from-[#FFCA40] to-[#FFB700] text-[#001D58] font-semibold rounded-lg shadow-lg shadow-[#FFCA40]/30 transition flex items-center gap-2"
          >
            <FiSearch />
            <span>Search</span>
          </button>
          {activeFiltersCount > 0 && (
            <button
              onClick={handleClearFilters}
              className="px-4 py-2.5 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/30 transition flex items-center gap-2"
            >
              <FiX />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 pt-4 border-t border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
                <FiFilter className="text-[#FFCA40]" />
                PAD Range (-1 to 1)
              </label>
              <div className="space-y-2">
                <div className="grid grid-cols-[70px_1fr_auto_1fr] items-center gap-2">
                  <span className="text-xs text-white/60">Valence</span>
                  <input
                    type="number"
                    min={-1}
                    max={1}
                    step={0.1}
                    value={filters.valenceMin ?? ''}
                    onChange={(e) => setPadFilterValue('valenceMin', e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCA40] transition"
                    placeholder="Min"
                  />
                  <span className="text-white/40">to</span>
                  <input
                    type="number"
                    min={-1}
                    max={1}
                    step={0.1}
                    value={filters.valenceMax ?? ''}
                    onChange={(e) => setPadFilterValue('valenceMax', e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCA40] transition"
                    placeholder="Max"
                  />
                </div>
                <div className="grid grid-cols-[70px_1fr_auto_1fr] items-center gap-2">
                  <span className="text-xs text-white/60">Arousal</span>
                  <input
                    type="number"
                    min={-1}
                    max={1}
                    step={0.1}
                    value={filters.arousalMin ?? ''}
                    onChange={(e) => setPadFilterValue('arousalMin', e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCA40] transition"
                    placeholder="Min"
                  />
                  <span className="text-white/40">to</span>
                  <input
                    type="number"
                    min={-1}
                    max={1}
                    step={0.1}
                    value={filters.arousalMax ?? ''}
                    onChange={(e) => setPadFilterValue('arousalMax', e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCA40] transition"
                    placeholder="Max"
                  />
                </div>
                <div className="grid grid-cols-[70px_1fr_auto_1fr] items-center gap-2">
                  <span className="text-xs text-white/60">Dominance</span>
                  <input
                    type="number"
                    min={-1}
                    max={1}
                    step={0.1}
                    value={filters.dominanceMin ?? ''}
                    onChange={(e) => setPadFilterValue('dominanceMin', e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCA40] transition"
                    placeholder="Min"
                  />
                  <span className="text-white/40">to</span>
                  <input
                    type="number"
                    min={-1}
                    max={1}
                    step={0.1}
                    value={filters.dominanceMax ?? ''}
                    onChange={(e) => setPadFilterValue('dominanceMax', e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCA40] transition"
                    placeholder="Max"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
                <FiCalendar className="text-[#FFCA40]" />
                Date Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCA40] transition"
                />
                <span className="text-white/50">to</span>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFCA40] transition"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
                <FiTag className="text-[#FFCA40]" />
                Tags
              </label>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {isLoadingTags ? (
                  <div className="text-white/50 text-sm">Loading tags...</div>
                ) : allTags.length > 0 ? (
                  allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1 rounded-full text-sm transition ${
                        filters.selectedTags.includes(tag)
                          ? 'bg-[#FFCA40] text-[#001D58] font-medium'
                          : 'bg-white/5 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      #{tag}
                    </button>
                  ))
                ) : (
                  <div className="text-white/50 text-sm">No tags available</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
