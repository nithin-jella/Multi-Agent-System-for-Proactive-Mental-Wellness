'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiCall } from '@/utils/adminApi';
import { Button } from '@/components/ui/Button';
import GlobalSkeleton from '@/components/ui/GlobalSkeleton';
import ErrorMessage from '@/components/ui/ErrorMessage';
import CbtModuleStepForm, { CbtModuleStep } from './CbtModuleStepForm';
import DeleteCbtModuleStepButton from './DeleteCbtModuleStepButton';
import { FiPlus, FiEdit } from 'react-icons/fi';
import Tooltip from '@/components/ui/Tooltip';

interface CbtModuleStepsTableProps {
    moduleId: number;
}

const CbtModuleStepsTable: React.FC<CbtModuleStepsTableProps> = ({ moduleId }) => {
    const [steps, setSteps] = useState<CbtModuleStep[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [selectedStep, setSelectedStep] = useState<CbtModuleStep | undefined>(undefined);

    const fetchSteps = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await apiCall<CbtModuleStep[]>(`/api/v1/admin/cbt-modules/${moduleId}/steps`);
            setSteps(data);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load steps';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [moduleId]);

    useEffect(() => {
        fetchSteps();
    }, [fetchSteps]);

    const handleFormSuccess = () => {
        setIsFormVisible(false);
        setSelectedStep(undefined);
        fetchSteps();
    };

    const handleAddNew = () => {
        setSelectedStep(undefined);
        setIsFormVisible(true);
    };

    const handleEdit = (step: CbtModuleStep) => {
        setSelectedStep(step);
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
                            <h2 className="text-xl font-semibold text-white">Steps</h2>
                            <p className="text-sm text-gray-300 mt-1">
                                Build this module step-by-step. Mix information, open questions, and summaries. Keep language simple and supportive.
                            </p>
                        </div>
                        <Button onClick={handleAddNew} className="inline-flex items-center px-4 py-2 bg-[#FFCA40] hover:bg-[#ffda63] text-black rounded-lg text-sm font-medium transition-colors">
                            <FiPlus className="mr-2" />
                            Add Step
                        </Button>
                    </div>

                    {steps.length === 0 ? (
                        <div className="px-6 pb-6">
                            <div className="border border-dashed border-white/20 rounded-lg p-6 text-center text-gray-300">
                                <p className="mb-2">No steps yet.</p>
                                <p className="mb-4 text-sm">Add your first step. Start with a short psychoeducation paragraph to set context.</p>
                                <Button onClick={handleAddNew} className="inline-flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors">
                                    <FiPlus className="mr-2" />
                                    Add First Step
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-white/20">
                                <thead className="bg-white/5">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Order</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Content</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-transparent divide-y divide-white/20">
                                    {steps.map((step) => (
                                        <tr key={step.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{step.step_order}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-500/20 text-blue-300">
                                                    {step.step_type.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-normal text-sm text-gray-300">{step.content}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <Tooltip title="Edit step">
                                                    <button onClick={() => handleEdit(step)} className="text-blue-400 hover:text-blue-300 mr-4" aria-label={`Edit step ${step.step_order}`}>
                                                        <FiEdit />
                                                    </button>
                                                </Tooltip>
                                                <Tooltip title="Delete step">
                                                    <span>
                                                        <DeleteCbtModuleStepButton stepId={step.id} onSuccess={fetchSteps} />
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
                        {selectedStep ? 'Edit Step' : 'Add a New Step'}
                    </h2>
                    <p className="text-sm text-gray-300 mb-4">Keep prompts concise and warm. Ask one thing at a time.</p>
                    <CbtModuleStepForm moduleId={moduleId} step={selectedStep} onSuccess={handleFormSuccess} />
                    <Button onClick={() => setIsFormVisible(false)} className="mt-4 bg-white/10 hover:bg-white/20 text-white">Cancel</Button>
                </div>
            )}
        </div>
    );
};

export default CbtModuleStepsTable;
