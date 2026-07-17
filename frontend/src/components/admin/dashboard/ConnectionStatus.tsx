/**
 * ConnectionStatus Component
 * 
 * Displays real-time SSE connection status indicator
 */

'use client';

import { CheckCircle, WifiOff, RefreshCw } from 'lucide-react';

interface ConnectionStatusProps {
  isConnected: boolean;
  error?: string | null;
  onReconnect?: () => void;
  className?: string;
}

export function ConnectionStatus({ 
  isConnected, 
  error, 
  onReconnect,
  className = ''
}: ConnectionStatusProps) {
  if (isConnected) {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <div className="relative">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <div className="absolute inset-0 animate-ping">
            <CheckCircle className="h-4 w-4 text-green-500 opacity-20" />
          </div>
        </div>
        <span className="text-green-600 dark:text-green-400 font-medium">
          Live Updates Active
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <WifiOff className="h-4 w-4 text-red-500" />
      <span className="text-red-600 dark:text-red-400 font-medium">
        {error || 'Connection Lost'}
      </span>
      {onReconnect && (
        <button
          onClick={onReconnect}
          className="ml-2 flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
          title="Reconnect"
        >
          <RefreshCw className="h-3 w-3" />
          Reconnect
        </button>
      )}
    </div>
  );
}
