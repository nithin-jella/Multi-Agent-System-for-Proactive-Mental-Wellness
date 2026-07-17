"use client";

import React, { useState, useEffect, useRef } from 'react';
import api from '@/services/api';
import { FiDatabase, FiRefreshCw, FiChevronLeft, FiChevronRight, FiAlertCircle, FiChevronDown, FiSearch, FiTrash2, FiArrowRight } from 'react-icons/fi';

interface Column {
    name: string;
    type: string;
    nullable: boolean;
    primary_key: boolean;
}

interface TableData {
    table_name: string;
    columns: Column[];
    data: any[];
    pagination: {
        page: number;
        limit: number;
        total_rows: number;
        total_pages: number;
    };
}

interface TableSchemaColumn {
    name: string;
    type: string;
    nullable: boolean;
    primary_key: boolean;
}

interface TableSchema {
    table_name: string;
    columns: TableSchemaColumn[];
}

interface TableRelationship {
    source_table: string;
    source_column: string;
    target_table: string;
    target_column: string;
    constraint_name: string | null;
}

interface DatabaseSchema {
    tables: TableSchema[];
    relationships: TableRelationship[];
}

export default function DatabaseViewerPage() {
    const [tables, setTables] = useState<string[]>([]);
    const [selectedTable, setSelectedTable] = useState<string>('');
    const [tableData, setTableData] = useState<TableData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);
    const [schema, setSchema] = useState<DatabaseSchema | null>(null);
    const [schemaLoading, setSchemaLoading] = useState(false);

    // Selection state
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);

    // Dropdown state
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fetch table list on mount
    useEffect(() => {
        fetchTables();
        fetchSchema();
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Fetch table data when selected table or page changes
    useEffect(() => {
        if (selectedTable) {
            fetchTableData(selectedTable, page, limit);
        }
    }, [selectedTable, page, limit]);

    // Clear selection when table or page changes
    useEffect(() => {
        setSelectedRows(new Set());
    }, [selectedTable, page]);

    const fetchTables = async () => {
        try {
            setLoading(true);
            const response = await api.get('/admin/database/tables');
            // Sort tables alphabetically
            const sortedTables = (response.data as string[]).sort((a, b) => a.localeCompare(b));
            setTables(sortedTables);
            if (sortedTables.length > 0 && !selectedTable) {
                // Optionally select first table
                // setSelectedTable(sortedTables[0]);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch tables');
        } finally {
            setLoading(false);
        }
    };

    const fetchTableData = async (tableName: string, pageNum: number, limitNum: number) => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get(`/admin/database/tables/${tableName}`, {
                params: { page: pageNum, limit: limitNum }
            });
            setTableData(response.data);
        } catch (err: any) {
            setError(err.message || `Failed to fetch data for ${tableName}`);
            setTableData(null);
        } finally {
            setLoading(false);
        }
    };

    const fetchSchema = async () => {
        try {
            setSchemaLoading(true);
            const response = await api.get('/admin/database/schema');
            setSchema(response.data as DatabaseSchema);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch schema relationships');
        } finally {
            setSchemaLoading(false);
        }
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked && tableData) {
            const allIndices = new Set(tableData.data.map((_, idx) => idx));
            setSelectedRows(allIndices);
        } else {
            setSelectedRows(new Set());
        }
    };

    const handleSelectRow = (index: number) => {
        const newSelected = new Set(selectedRows);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedRows(newSelected);
    };

    const handleDelete = async () => {
        if (!tableData || selectedRows.size === 0) return;
        
        if (!confirm(`Are you sure you want to delete ${selectedRows.size} rows? This action cannot be undone.`)) {
            return;
        }

        setIsDeleting(true);
        try {
            // Identify PK columns
            const pkColumns = tableData.columns.filter(col => col.primary_key).map(col => col.name);
            
            if (pkColumns.length === 0) {
                throw new Error("Cannot delete rows from a table without a primary key.");
            }

            // Construct payload
            const rowsToDelete = Array.from(selectedRows).map(idx => {
                const row = tableData.data[idx];
                const keyMap: Record<string, any> = {};
                pkColumns.forEach(pk => {
                    keyMap[pk] = row[pk];
                });
                return keyMap;
            });

            await api.delete(`/admin/database/tables/${selectedTable}`, {
                data: { rows: rowsToDelete }
            });

            // Refresh data
            fetchTableData(selectedTable, page, limit);
            setSelectedRows(new Set());
        } catch (err: any) {
            setError(err.message || "Failed to delete rows");
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredTables = tables.filter(table => 
        table.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedTableRelationships = selectedTable && schema
        ? schema.relationships.filter(
            (rel) => rel.source_table === selectedTable || rel.target_table === selectedTable
        )
        : [];

    return (
        <div className="p-6 max-w-400 mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <FiDatabase className="text-blue-500" />
                        Database Viewer
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Inspect raw database tables and content.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Delete Button */}
                    {selectedRows.size > 0 && (
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                        >
                            <FiTrash2 />
                            {isDeleting ? 'Deleting...' : `Delete (${selectedRows.size})`}
                        </button>
                    )}

                    {/* Custom Searchable Dropdown */}
                    <div className="relative w-64" ref={dropdownRef}>
                        <div
                            className="flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm cursor-pointer hover:border-blue-500 transition-colors"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        >
                            <span className={`truncate ${!selectedTable ? "text-slate-400" : "text-slate-900 dark:text-slate-200"}`}>
                                {selectedTable || "Select a table..."}
                            </span>
                            <FiChevronDown className={`transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                        </div>

                        {isDropdownOpen && (
                            <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 max-h-80 flex flex-col overflow-hidden">
                                <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                    <div className="flex items-center px-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
                                        <FiSearch className="text-slate-400 shrink-0" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search tables..."
                                            className="w-full p-2 bg-transparent border-none focus:ring-0 text-sm outline-none text-slate-900 dark:text-slate-200 placeholder:text-slate-400"
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </div>
                                <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                                    {filteredTables.length === 0 ? (
                                        <div className="px-4 py-3 text-slate-400 text-sm text-center italic">
                                            No tables found
                                        </div>
                                    ) : (
                                        filteredTables.map(table => (
                                            <div
                                                key={table}
                                                className={`px-4 py-2 cursor-pointer text-sm transition-colors flex items-center justify-between
                                                    ${selectedTable === table 
                                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' 
                                                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                                                    }`}
                                                onClick={() => {
                                                    setSelectedTable(table);
                                                    setPage(1);
                                                    setIsDropdownOpen(false);
                                                    setSearchQuery("");
                                                }}
                                            >
                                                {table}
                                                {selectedTable === table && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => {
                            if (selectedTable) {
                                fetchTableData(selectedTable, page, limit);
                            }
                            fetchSchema();
                        }}
                        className="p-2 text-slate-500 hover:text-blue-500 transition-colors bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                        title="Refresh Data & Schema"
                    >
                        <FiRefreshCw className={loading ? "animate-spin" : ""} size={20} />
                    </button>
                </div>
            </div>

            {/* ERD / Relationship Figure */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Table Relationship Figure</h2>
                    <div className="text-xs text-slate-500">
                        {schemaLoading
                            ? 'Loading schema...'
                            : `Tables: ${schema?.tables.length ?? 0} · Relationships: ${schema?.relationships.length ?? 0}`}
                    </div>
                </div>

                {selectedTable ? (
                    <p className="text-xs text-slate-500">
                        Showing relationships for <span className="font-medium text-slate-700 dark:text-slate-300">{selectedTable}</span>
                    </p>
                ) : (
                    <p className="text-xs text-slate-500">Select a table to focus its inbound/outbound relationships.</p>
                )}

                <div className="overflow-x-auto">
                    {selectedTable && selectedTableRelationships.length > 0 ? (
                        <div className="min-w-180 space-y-2">
                            {selectedTableRelationships.map((rel, idx) => {
                                const isOutbound = rel.source_table === selectedTable;
                                return (
                                    <div key={`${rel.source_table}-${rel.source_column}-${rel.target_table}-${rel.target_column}-${idx}`} className="flex items-center gap-3 text-sm">
                                        <span className={`rounded-md border px-2 py-1 ${isOutbound ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-900/20 dark:text-blue-300' : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-300'}`}>
                                            {rel.source_table}.{rel.source_column}
                                        </span>
                                        <FiArrowRight className="text-slate-400" />
                                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-200">
                                            {rel.target_table}.{rel.target_column}
                                        </span>
                                        <span className="text-xs text-slate-400">{rel.constraint_name ?? 'fk'}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-sm text-slate-400 py-2">
                            {selectedTable ? 'No foreign-key relationship found for selected table.' : 'No table selected.'}
                        </div>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg flex items-center gap-2">
                    <FiAlertCircle />
                    {error}
                </div>
            )}

            {/* Data Table */}
            {selectedTable && tableData ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-250px)]">
                    {/* Table Info Bar */}
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center text-xs text-slate-500">
                        <span>
                            Showing {tableData.data.length} rows (Total: {tableData.pagination.total_rows})
                        </span>
                        <div className="flex gap-4">
                            {tableData.columns.map(col => (
                                <span key={col.name} className={col.primary_key ? "text-blue-500 font-medium" : ""}>
                                    {col.name} <span className="opacity-50">({col.type})</span>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Scrollable Table Area */}
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 w-10 border-b border-slate-200 dark:border-slate-700">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            checked={tableData.data.length > 0 && selectedRows.size === tableData.data.length}
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                    {tableData.columns.map((col) => (
                                        <th
                                            key={col.name}
                                            className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap"
                                        >
                                            <div className="flex items-center gap-1">
                                                {col.name}
                                                {col.primary_key && <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded">PK</span>}
                                                {col.nullable && <span className="text-[10px] text-slate-400">null</span>}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {tableData.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={tableData.columns.length + 1} className="px-4 py-8 text-center text-slate-500">
                                            No data found in this table.
                                        </td>
                                    </tr>
                                ) : (
                                    tableData.data.map((row, idx) => (
                                        <tr 
                                            key={idx} 
                                            className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${selectedRows.has(idx) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                                            onClick={() => handleSelectRow(idx)}
                                        >
                                            <td className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                    checked={selectedRows.has(idx)}
                                                    onChange={() => handleSelectRow(idx)}
                                                />
                                            </td>
                                            {tableData.columns.map((col) => {
                                                const cellValue = row[col.name];
                                                let displayValue = cellValue;

                                                if (cellValue === null) displayValue = <span className="text-slate-300 italic">null</span>;
                                                else if (typeof cellValue === 'boolean') displayValue = cellValue ? 'true' : 'false';
                                                else if (typeof cellValue === 'object') displayValue = JSON.stringify(cellValue);
                                                else if (String(cellValue).length > 50) displayValue = <span title={String(cellValue)}>{String(cellValue).substring(0, 50)}...</span>;

                                                return (
                                                    <td key={col.name} className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                                                        {displayValue}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between">
                        <div className="text-sm text-slate-500">
                            Page {page} of {tableData.pagination.total_pages || 1}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1 || loading}
                                className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FiChevronLeft />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(tableData.pagination.total_pages, p + 1))}
                                disabled={page >= tableData.pagination.total_pages || loading}
                                className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FiChevronRight />
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                !loading && (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                        <FiDatabase size={48} className="mb-4 opacity-50" />
                        <p>Select a table to view its contents</p>
                    </div>
                )
            )}
        </div>
    );
}
