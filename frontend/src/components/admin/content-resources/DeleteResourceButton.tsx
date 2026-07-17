/* eslint-disable */
// frontend/src/components/admin/content-resources/DeleteResourceButton.tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { apiCall } from '@/utils/adminApi';
import ErrorMessage from '@/components/ui/ErrorMessage';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface DeleteResourceButtonProps {
    resourceId: number;
    onSuccess: () => void;
}

const DeleteResourceButton: React.FC<DeleteResourceButtonProps> = ({ resourceId, onSuccess }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const handleDeleteConfirmed = async () => {
        setDialogOpen(false);
        setIsLoading(true);
        setError(null);
        try {
            await apiCall(`/api/v1/admin/content-resources/${resourceId}`, {
                method: 'DELETE',
            });
            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <Button
                variant="destructive"
                size="sm"
                onClick={() => setDialogOpen(true)}
                disabled={isLoading}
            >
                {isLoading ? 'Deleting...' : 'Delete'}
            </Button>
            {error && <ErrorMessage message={error} />}

            <ConfirmDialog
                isOpen={dialogOpen}
                title="Delete Resource"
                message="Are you sure you want to delete this resource? This action cannot be undone."
                confirmLabel="Delete"
                cancelLabel="Cancel"
                variant="danger"
                onConfirm={handleDeleteConfirmed}
                onCancel={() => setDialogOpen(false)}
            />
        </>
    );
};

export default DeleteResourceButton;
