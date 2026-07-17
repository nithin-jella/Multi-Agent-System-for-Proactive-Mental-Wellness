/**
 * Admin System Status Page
 */
'use client';

import React from 'react';
import { AuthWrapper } from '@/components/auth/AuthWrapper';
import SystemStatusDashboard from '@/components/admin/SystemStatusDashboard';

export default function AdminSystemStatusPage() {
  return (
    <AuthWrapper requireAdmin>
      <div className="min-h-screen bg-gray-50">
        <SystemStatusDashboard />
      </div>
    </AuthWrapper>
  );
}