// frontend/src/components/ui/ClientOnlyToaster.tsx
'use client';

import dynamic from 'next/dynamic';
import { ToasterProps } from 'react-hot-toast';

// Dynamically import the Toaster component with SSR disabled
const DynamicToaster = dynamic(
  () => import('react-hot-toast').then((mod) => mod.Toaster),
  { ssr: false }
);

// Re-export with a wrapper to pass props
export const ClientOnlyToaster: React.FC<ToasterProps> = (props) => {
  return <DynamicToaster {...props} />;
};
