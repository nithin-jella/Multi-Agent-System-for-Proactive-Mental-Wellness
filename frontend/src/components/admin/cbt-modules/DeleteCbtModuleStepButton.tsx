'use client';

import React, { useState } from 'react';
import { apiCall } from '@/utils/adminApi';
import { FiTrash2 } from 'react-icons/fi';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface DeleteCbtModuleStepButtonProps {
    stepId: number;
    onSuccess: () => void;
}

const DeleteCbtModuleStepButton: React.FC<DeleteCbtModuleStepButtonProps> = ({ stepId, onSuccess }) => {
    const [isDeleting, setIsDeleting] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDeleteConfirmed = async () => {
        setDialogOpen(false);
        setIsDeleting(true);
        setError(null);
        try {
            await apiCall(`/api/v1/admin/cbt-modules/steps/${stepId}`, {
                method: 'DELETE',
            });
            onSuccess();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to delete step';
            setError(message);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setDialogOpen(true)}
                disabled={isDeleting}
                className="text-red-500 hover:text-red-400 disabled:opacity-50"
                title="Delete step"
            >
                {isDeleting ? '...' : <FiTrash2 />}
            </button>

            {error && (
                <p className="text-xs text-red-400 mt-1">{error}</p>
            )}

            <ConfirmDialog
                isOpen={dialogOpen}
                title="Delete Step"
                message="Are you sure you want to delete this step? This action cannot be undone."
                confirmLabel="Delete"
                cancelLabel="Cancel"
                variant="danger"
                onConfirm={handleDeleteConfirmed}
                onCancel={() => setDialogOpen(false)}
            />
        </>
    );
};

export default DeleteCbtModuleStepButton;
