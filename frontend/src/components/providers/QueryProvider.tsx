'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

export default function QueryProvider({ children }: { children: ReactNode }) {
  // Create a client instance for this component's lifetime
  // useState ensures the client is only created once per component mount
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Default options for all queries
        staleTime: 60 * 1000, // 60 seconds
        refetchOnWindowFocus: false, // Don't refetch on window focus by default
        retry: 1, // Retry failed requests once
      },
      mutations: {
        // Default options for all mutations
        retry: 0, // Don't retry mutations by default
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
