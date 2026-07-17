'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiCall } from '@/utils/adminApi';
import { Button } from '@/components/ui/Button';
import GlobalSkeleton from '@/components/ui/GlobalSkeleton';
import ErrorMessage from '@/components/ui/ErrorMessage';
import CbtModuleForm from './CbtModuleForm';
import DeleteCbtModuleButton from './DeleteCbtModuleButton';
import { FiPlus, FiEdit, FiList } from 'react-icons/fi';
import Tooltip from '@/components/ui/Tooltip';

interface CbtModule {
    id: number;
    title: string;
    description: string;
}

interface CbtModuleResponse {
    items: CbtModule[];
    total_count: number;
}

const CbtModulesTable = () => {
    const [modules, setModules] = useState<CbtModule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [selectedModule, setSelectedModule] = useState<CbtModule | undefined>(undefined);

    const fetchModules = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await apiCall<CbtModuleResponse>('/api/v1/admin/cbt-modules?page=1&limit=10');
            setModules(data.items);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load modules';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchModules();
    }, [fetchModules]);

    const handleFormSuccess = () => {
        setIsFormVisible(false);
        setSelectedModule(undefined);
        fetchModules();
    };

    const handleAddNew = () => {
        setSelectedModule(undefined);
        setIsFormVisible(true);
    };

    const handleEdit = (module: CbtModule) => {
        setSelectedModule(module);
        setIsFormVisible(true);
    };

    if (isLoading) {
        return <GlobalSkeleton />;
    }

    if (error) {
        return <ErrorMessage message={error} />;
    }

    return (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
            {!isFormVisible ? (
                <>
                    <div className="p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-white">CBT Modules</h2>
                            <p className="text-sm text-gray-300 mt-1">
                                Create guided, step-by-step experiences to help students practice skills like
                                cognitive restructuring, problem solving, and mindfulness.
                            </p>
                        </div>
                        <Button onClick={handleAddNew} className="inline-flex items-center px-4 py-2 bg-[#FFCA40] hover:bg-[#ffda63] text-black rounded-lg text-sm font-medium transition-colors">
                            <FiPlus className="mr-2" />
                            Add Module
                        </Button>
                    </div>

                    {modules.length === 0 ? (
                        <div className="px-6 pb-6">
                            <div className="border border-dashed border-white/20 rounded-lg p-6 text-center text-gray-300">
                                <p className="mb-2">No modules yet.</p>
                                <p className="mb-4 text-sm">Start by creating your first CBT module. You can add steps afterwards.</p>
                                <Button onClick={handleAddNew} className="inline-flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors">
                                    <FiPlus className="mr-2" />
                                    Create First Module
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-white/20">
                                <thead className="bg-white/5">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Title</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Description</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-transparent divide-y divide-white/20">
                                    {modules.map((module) => (
                                        <tr key={module.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{module.title}</td>
                                            <td className="px-6 py-4 whitespace-normal text-sm text-gray-300">{module.description}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <Tooltip title="Manage steps">
                                                    <Link href={`/admin/cbt-modules/${module.id}/steps`} className="inline-flex items-center text-green-400 hover:text-green-300 mr-4" aria-label={`Manage steps for ${module.title}`}>
                                                        <FiList className="mr-1" />
                                                        <span className="hidden sm:inline">Steps</span>
                                                    </Link>
                                                </Tooltip>
                                                <Tooltip title="Edit module">
                                                    <button onClick={() => handleEdit(module)} className="inline-flex items-center text-blue-400 hover:text-blue-300 mr-4" aria-label={`Edit ${module.title}`}>
                                                        <FiEdit className="mr-1" />
                                                        <span className="hidden sm:inline">Edit</span>
                                                    </button>
                                                </Tooltip>
                                                <Tooltip title="Delete module">
                                                    <span>
                                                        <DeleteCbtModuleButton moduleId={module.id} onSuccess={fetchModules} />
                                                    </span>
                                                </Tooltip>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            ) : (
                <div className="p-6">
                    <h2 className="text-xl font-semibold text-white mb-2">
                        {selectedModule ? 'Edit Module' : 'Create a New Module'}
                    </h2>
                    <p className="text-sm text-gray-300 mb-4">Give your module a clear, student-friendly title and a short description of what they’ll practice.</p>
                    <CbtModuleForm module={selectedModule} onSuccess={handleFormSuccess} />
                    <Button onClick={() => setIsFormVisible(false)} className="mt-4 bg-white/10 hover:bg-white/20 text-white">Cancel</Button>
                </div>
            )}
        </div>
    );
};

export default CbtModulesTable;
