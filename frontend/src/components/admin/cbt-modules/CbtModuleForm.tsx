'use client';

import React, { useState, useEffect } from 'react';
import { apiCall } from '@/utils/adminApi';
import { Button } from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Textarea } from '@/components/ui/TextArea';

interface CbtModule {
    id: number;
    title: string;
    description: string;
}

interface CbtModuleFormProps {
    module?: CbtModule;
    onSuccess: () => void;
}

const CbtModuleForm: React.FC<CbtModuleFormProps> = ({ module, onSuccess }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (module) {
            setTitle(module.title);
            setDescription(module.description);
        }
    }, [module]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        const payload = { title, description };

        try {
            if (module) {
                await apiCall(`/api/v1/admin/cbt-modules/${module.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                });
            } else {
                await apiCall('/api/v1/admin/cbt-modules', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
            }
            onSuccess();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save module';
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-red-500 mb-2">{error}</p>}

            <Input
                name="title"
                label="Module title"
                placeholder="e.g., Menantang Pikiran Negatif (CBT)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full pl-10 pr-3 py-3 bg-white/8 border border-white/15 rounded-xl text-white placeholder-white/40 focus:ring-2 focus:ring-[#FFCA40]/50 focus:border-[#FFCA40]/50 outline-none transition-all duration-300 backdrop-blur-sm hover:bg-white/10"
            />
            <p className="text-xs text-gray-400 -mt-2">Use clear, student-facing language. This appears wherever the module is listed.</p>

            <div className="space-y-1">
                <label htmlFor="description" className="block text-sm font-medium text-gray-300">Short description</label>
                <Textarea
                    id="description"
                    placeholder="What will students practice or learn in this module? Keep it short and friendly."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    rows={4}
                    className="w-full min-h-[150px] p-3 bg-white/8 border border-white/15 rounded-xl text-white placeholder-white/40 focus:ring-2 focus:ring-[#FFCA40]/50 focus:border-[#FFCA40]/50 outline-none transition-all duration-300 backdrop-blur-sm hover:bg-white/10"
                />
                <p className="text-xs text-gray-400">Tip: Focus on outcomes (e.g., “Belajar mengenali pola pikir yang tidak membantu dan menggantinya dengan perspektif yang lebih seimbang”).</p>
            </div>

            <div className="pt-2">
                <Button type="submit" disabled={isSubmitting} variant="primaryGold" className="shadow-lg hover:shadow-xl">
                    {isSubmitting ? 'Saving…' : 'Save Module'}
                </Button>
            </div>
        </form>
    );
};

export default CbtModuleForm;
