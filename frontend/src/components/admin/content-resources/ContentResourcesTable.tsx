/* eslint-disable */
// frontend/src/components/admin/content-resources/ContentResourcesTable.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiCall } from '@/utils/adminApi';
import { Button } from '@/components/ui/Button';
import GlobalSkeleton from '@/components/ui/GlobalSkeleton';
import ErrorMessage from '@/components/ui/ErrorMessage';
import ContentResourceForm from './ContentResourceForm';
import DeleteResourceButton from './DeleteResourceButton';
import { FiPlus, FiEdit, FiSearch, FiFilter, FiChevronUp, FiChevronDown, FiEye, FiExternalLink, FiFileText, FiGlobe, FiFile, FiCheckCircle, FiClock, FiXCircle, FiX } from 'react-icons/fi';

interface ContentResource {
    id: number;
    title: string;
    type: string;
    source: string | null;
    description?: string | null;
    created_at: string;
    updated_at: string;
    content: string;
    tags: string[];
    metadata: Record<string, unknown>;
    mime_type?: string | null;
    embedding_status: string;
    embedding_last_processed_at?: string | null;
    chunk_count: number;
    storage_backend: string;
    object_storage_key?: string | null;
    object_storage_bucket?: string | null;
}

interface ContentResourceResponse {
    items: ContentResource[];
    total_count: number;
}

interface ResourceStats {
    totalResources: number;
    byType: { text: number; url: number; pdf: number };
    byStatus: { succeeded: number; pending: number; failed: number };
}

const ContentResourcesTable = () => {
    const [resources, setResources] = useState<ContentResource[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [selectedResource, setSelectedResource] = useState<ContentResource | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const [resourceTypes, setResourceTypes] = useState<string[]>([]);
    const [selectedType, setSelectedType] = useState('');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [viewingResource, setViewingResource] = useState<ContentResource | null>(null);
    const [stats, setStats] = useState<ResourceStats>({
        totalResources: 0,
        byType: { text: 0, url: 0, pdf: 0 },
        byStatus: { succeeded: 0, pending: 0, failed: 0 }
    });

    const fetchResourceTypes = useCallback(async () => {
        // Set hardcoded types since backend doesn't have a types endpoint
        setResourceTypes(['text', 'url', 'pdf']);
    }, []);

    const calculateStats = useCallback((allResources: ContentResource[], totalCount?: number) => {
        const newStats: ResourceStats = {
            totalResources: totalCount ?? allResources.length,
            byType: { text: 0, url: 0, pdf: 0 },
            byStatus: { succeeded: 0, pending: 0, failed: 0 }
        };

        allResources.forEach(resource => {
            if (resource.type === 'text') newStats.byType.text++;
            else if (resource.type === 'url') newStats.byType.url++;
            else if (resource.type === 'pdf') newStats.byType.pdf++;

            if (resource.embedding_status === 'succeeded') newStats.byStatus.succeeded++;
            else if (resource.embedding_status === 'failed') newStats.byStatus.failed++;
            else newStats.byStatus.pending++;
        });

        setStats(newStats);
    }, []);

    const fetchResources = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '10',
                search: searchTerm,
                type: selectedType,
                sort_by: sortBy,
                sort_order: sortOrder,
            });
            const data = await apiCall<ContentResourceResponse>(`/api/v1/admin/content-resources?${params.toString()}`);
            const processedResources = data.items.map((item) => ({
                ...item,
                tags: item.tags ?? [],
                metadata: item.metadata ?? {},
            }));
            setResources(processedResources);
            setTotalPages(Math.ceil(data.total_count / 10));

            // Fetch up to 100 resources for better stats (API limit is 100)
            // This gives us a good representation of the overall distribution
            const statsParams = new URLSearchParams({ limit: '100', page: '1' });
            const statsData = await apiCall<ContentResourceResponse>(`/api/v1/admin/content-resources?${statsParams.toString()}`);
            calculateStats(statsData.items, data.total_count);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [page, searchTerm, selectedType, sortBy, sortOrder, calculateStats]);

    useEffect(() => {
        fetchResourceTypes();
    }, [fetchResourceTypes]);

    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            fetchResources();
        }, 500);
        return () => clearTimeout(debounceTimer);
    }, [fetchResources]);

    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('asc');
        }
    };

    const handleFormSuccess = () => {
        setIsFormVisible(false);
        setSelectedResource(undefined);
        fetchResources();
    };

    const handleAddNew = () => {
        setSelectedResource(undefined);
        setIsFormVisible(true);
    };

    const handleEdit = (resource: ContentResource) => {
        setSelectedResource(resource);
        setIsFormVisible(true);
    };

    if (isLoading) {
        return <GlobalSkeleton />;
    }

    if (error) {
        return <ErrorMessage message={error} />;
    }

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'text': return <FiFileText className="h-4 w-4" />;
            case 'url': return <FiGlobe className="h-4 w-4" />;
            case 'pdf': return <FiFile className="h-4 w-4" />;
            default: return <FiFileText className="h-4 w-4" />;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'succeeded': return 'Ready';
            case 'failed': return 'Failed';
            case 'pending': return 'Processing';
            default: return status;
        }
    };

    return (
        <div className="space-y-6">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-[#FFCA40]/20 to-[#FFD700]/10 border border-[#FFCA40]/30 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-white/60 uppercase tracking-wide">Total Resources</p>
                            <p className="text-3xl font-bold text-white mt-1">{stats.totalResources}</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-[#FFCA40]/20 flex items-center justify-center">
                            <FiFileText className="h-6 w-6 text-[#FFCA40]" />
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-white/60 uppercase tracking-wide">AI Ready</p>
                            <p className="text-3xl font-bold text-white mt-1">{stats.byStatus.succeeded}</p>
                            <p className="text-xs text-green-200 mt-1">Available for AI</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                            <FiCheckCircle className="h-6 w-6 text-green-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-white/60 uppercase tracking-wide">Processing</p>
                            <p className="text-3xl font-bold text-white mt-1">{stats.byStatus.pending}</p>
                            <p className="text-xs text-yellow-200 mt-1">Being embedded</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                            <FiClock className="h-6 w-6 text-yellow-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-white/60 uppercase tracking-wide">Failed</p>
                            <p className="text-3xl font-bold text-white mt-1">{stats.byStatus.failed}</p>
                            <p className="text-xs text-red-200 mt-1">Need attention</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                            <FiXCircle className="h-6 w-6 text-red-400" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
                <div className="p-6 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search resources..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                aria-label="Search resources"
                                className="pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[#FFCA40] focus:border-[#FFCA40] transition-colors"
                            />
                        </div>
                        <div className="relative">
                            <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <select
                                value={selectedType}
                                onChange={(e) => setSelectedType(e.target.value)}
                                title="Filter by type"
                                aria-label="Filter by type"
                                className="pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-[#FFCA40] focus:border-[#FFCA40] transition-colors"
                            >
                                <option value="">All Types</option>
                                {resourceTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <Button onClick={handleAddNew} className="inline-flex items-center px-4 py-2 bg-[#FFCA40] hover:bg-[#ffda63] text-black rounded-lg text-sm font-medium transition-colors">
                        <FiPlus className="mr-2" />
                        Add Resource
                    </Button>
                </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-white/20">
                            <thead className="bg-white/5">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('title')}>
                                        Title {sortBy === 'title' && (sortOrder === 'asc' ? <FiChevronUp className="inline" /> : <FiChevronDown className="inline" />)}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('type')}>
                                        Type {sortBy === 'type' && (sortOrder === 'asc' ? <FiChevronUp className="inline" /> : <FiChevronDown className="inline" />)}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Source</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('created_at')}>
                                        Created At {sortBy === 'created_at' && (sortOrder === 'asc' ? <FiChevronUp className="inline" /> : <FiChevronDown className="inline" />)}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tags</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('embedding_status')}>
                                        Embedding {sortBy === 'embedding_status' && (sortOrder === 'asc' ? <FiChevronUp className="inline" /> : <FiChevronDown className="inline" />)}
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-transparent divide-y divide-white/20">
                                {resources.map((resource) => (
                                    <tr key={resource.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 text-sm">
                                            <div className="font-medium text-white">{resource.title}</div>
                                            {resource.description && (
                                                <div className="text-xs text-gray-400 mt-1 max-w-xs truncate">{resource.description}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 text-gray-300">
                                                {getTypeIcon(resource.type)}
                                                <span className="capitalize">{resource.type}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-300 max-w-xs">
                                            {resource.source ? (
                                                <span className="truncate block" title={resource.source}>{resource.source}</span>
                                            ) : '—'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                            {new Date(resource.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            {resource.tags.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {resource.tags.slice(0, 2).map(tag => (
                                                        <span key={tag} className="inline-block px-2 py-0.5 rounded-full text-xs bg-[#FFCA40]/20 text-[#FFCA40] border border-[#FFCA40]/30">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                    {resource.tags.length > 2 && (
                                                        <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-white/10 text-gray-400">
                                                            +{resource.tags.length - 2}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-500">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                                                resource.embedding_status === 'succeeded' 
                                                    ? 'bg-green-500/20 text-green-200 border border-green-500/30' 
                                                    : resource.embedding_status === 'failed' 
                                                    ? 'bg-red-500/20 text-red-200 border border-red-500/30' 
                                                    : 'bg-yellow-500/20 text-yellow-200 border border-yellow-500/30'
                                            }`}>
                                                {resource.embedding_status === 'succeeded' && <FiCheckCircle className="h-3 w-3" />}
                                                {resource.embedding_status === 'failed' && <FiXCircle className="h-3 w-3" />}
                                                {resource.embedding_status === 'pending' && <FiClock className="h-3 w-3" />}
                                                {getStatusLabel(resource.embedding_status)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => setViewingResource(resource)} 
                                                    className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg transition-all"
                                                    title="View resource"
                                                >
                                                    <FiEye className="h-4 w-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleEdit(resource)} 
                                                    className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-all"
                                                    title="Edit resource"
                                                >
                                                    <FiEdit className="h-4 w-4" />
                                                </button>
                                                <DeleteResourceButton resourceId={resource.id} onSuccess={fetchResources} />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination */}
                    <div className="bg-white/5 px-4 py-3 flex items-center justify-between border-t border-white/20 sm:px-6">
                        <div className="flex-1 flex justify-between sm:hidden">
                            <Button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                            <Button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="ml-2">Next</Button>
                        </div>
                        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-gray-300">
                                    Page {page} of {totalPages}
                                </p>
                            </div>
                            <div>
                                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                    <Button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-white/20 bg-white/10 text-sm font-medium text-gray-300 hover:bg-white/20">Previous</Button>
                                    <Button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-white/20 bg-white/10 text-sm font-medium text-gray-300 hover:bg-white/20">Next</Button>
                                </nav>
                            </div>
                        </div>
                    </div>
            </div>

            {/* Form Modal */}
            {isFormVisible && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 z-50" onClick={() => setIsFormVisible(false)}>
                    <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-white/20 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white">
                                {selectedResource ? 'Edit Resource' : 'Add New Resource'}
                            </h3>
                            <button
                                onClick={() => setIsFormVisible(false)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                                title="Close"
                            >
                                <FiX className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto">
                            <ContentResourceForm resource={selectedResource} onSuccess={handleFormSuccess} />
                        </div>
                    </div>
                </div>
            )}

            {/* View Resource Modal */}
            {viewingResource && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 sm:p-8 z-50" onClick={() => setViewingResource(null)}>
                    <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-white/20">
                            <h3 className="text-lg font-medium text-white">{viewingResource.title}</h3>
                            {viewingResource.description && (
                                <p className="mt-1 text-sm text-gray-300">{viewingResource.description}</p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-300">
                                <span className="rounded-full bg-white/10 px-3 py-1 uppercase tracking-wide">{viewingResource.type}</span>
                                {(viewingResource.tags || []).map((tag) => (
                                    <span key={tag} className="rounded-full bg-white/10 px-3 py-1">{tag}</span>
                                ))}
                                <span className="rounded-full bg-white/10 px-3 py-1">Embedding: {viewingResource.embedding_status}</span>
                                <span className="rounded-full bg-white/10 px-3 py-1">Chunks: {viewingResource.chunk_count}</span>
                                <span className="rounded-full bg-white/10 px-3 py-1">Storage: {viewingResource.storage_backend}</span>
                            </div>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto">
                            {viewingResource.type === 'pdf' && viewingResource.object_storage_key ? (
                                <iframe
                                    title={viewingResource.title}
                                    src={`/api/v1/admin/content-resources/${viewingResource.id}/file`}
                                    className="w-full min-h-[520px] rounded-xl border border-white/20 bg-black/10"
                                />
                            ) : viewingResource.type === 'url' ? (
                                <div className="space-y-4">
                                    {viewingResource.source && (
                                        <a href={viewingResource.source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-[#FFCA40] hover:text-[#ffd86b]">
                                            <FiExternalLink className="mr-2" />
                                            {viewingResource.source}
                                        </a>
                                    )}
                                    <div className="bg-black/20 p-4 rounded-xl text-gray-200 whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
                                        {viewingResource.content || 'No extracted content available yet.'}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-black/20 p-4 rounded-xl text-gray-200 whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
                                    {viewingResource.content}
                                </div>
                            )}
                        </div>
                        <div className="px-6 pb-6 text-xs text-gray-300 space-y-1">
                            <div>Created: {new Date(viewingResource.created_at).toLocaleString()}</div>
                            <div>Updated: {new Date(viewingResource.updated_at).toLocaleString()}</div>
                            {viewingResource.embedding_last_processed_at && (
                                <div>Embedded: {new Date(viewingResource.embedding_last_processed_at).toLocaleString()}</div>
                            )}
                            {viewingResource.metadata && Object.keys(viewingResource.metadata).length > 0 && (
                                <div className="mt-3">
                                    <h4 className="font-medium text-gray-200 mb-2">Metadata</h4>
                                    <pre className="bg-black/20 p-3 rounded-lg text-[11px] whitespace-pre-wrap break-words">{JSON.stringify(viewingResource.metadata, null, 2)}</pre>
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-3 bg-black/20 border-t border-white/20 text-right">
                            <Button onClick={() => setViewingResource(null)} className="bg-white/20 hover:bg-white/30 text-white">Close</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContentResourcesTable;
