import React from 'react';
import { Metadata } from 'next';
import { FiList } from 'react-icons/fi';
import CbtModuleStepsTable from '@/components/admin/cbt-modules/CbtModuleStepsTable';

export const metadata: Metadata = {
    title: 'Admin: CBT Module Steps',
};

type ParamsPromise = Promise<{ moduleId: string }>;

const CbtModuleStepsPage = async ({ params }: { params?: ParamsPromise }) => {
    const resolvedParams = params ? await params : { moduleId: '0' };
    const moduleIdNumber = parseInt(resolvedParams.moduleId, 10);

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center">
                        <FiList className="mr-3 text-[#FFCA40]" />
                        CBT Module Steps
                    </h1>
                    <p className="text-gray-400 mt-1">Manage steps for module {moduleIdNumber}</p>
                </div>
            </div>
            <CbtModuleStepsTable moduleId={moduleIdNumber} />
        </div>
    );
};

export default CbtModuleStepsPage;
