import React from 'react';
import { Metadata } from 'next';
import { FiHeart } from 'react-icons/fi';
import CbtModulesTable from '@/components/admin/cbt-modules/CbtModulesTable';

export const metadata: Metadata = {
    title: 'Admin: CBT Modules',
};

const CbtModulesPage = () => {
    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center">
                        <FiHeart className="mr-3 text-[#FFCA40]" />
                        CBT Modules
                    </h1>
                    <p className="text-gray-400 mt-1">Manage content for the CBT modules</p>
                </div>
            </div>
            <CbtModulesTable />
        </div>
    );
};

export default CbtModulesPage;
