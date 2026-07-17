/**
 * System Status Dashboard - Admin panel component for monitoring system health
 */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity,
  Database,
  Code,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Settings,
  RefreshCw,
  BarChart3,
  Clock,
  Users,
  Zap
} from 'lucide-react';

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  timestamp: string;
  summary: {
    total_endpoints: number;
    total_requests_last_hour: number;
    average_response_time: string;
    overall_success_rate: string;
  };
  alerts: {
    critical: number;
    warning: number;
    info: number;
  };
  top_slow_endpoints: Array<{
    endpoint: string;
    avg_response_time: string;
    requests: number;
  }>;
  top_error_endpoints: Array<{
    endpoint: string;
    error_rate: string;
    total_requests: number;
  }>;
}

interface DatabaseHealth {
  status: 'healthy' | 'warning' | 'critical';
  timestamp: string;
  pool_stats: {
    size: number;
    active: number;
    idle: number;
    utilization: string;
  };
  performance: {
    active_connections: number;
    idle_connections: number;
    waiting_connections: number;
    slow_queries: number;
    avg_query_time: string;
    lock_waits: number;
  };
  alerts: Array<{
    level: string;
    message: string;
    recommendation: string;
  }>;
  recommendations: string[];
}

interface CleanupReport {
  summary: {
    total_files_with_issues: number;
    category_totals: Record<string, number>;
    scan_timestamp: string;
  };
  recommendations: string[];
}

const StatusIndicator: React.FC<{ status: string; className?: string }> = ({ 
  status, 
  className = "w-6 h-6" 
}) => {
  switch (status) {
    case 'healthy':
      return <CheckCircle className={`${className} text-green-500`} />;
    case 'warning':
      return <AlertTriangle className={`${className} text-yellow-500`} />;
    case 'critical':
      return <XCircle className={`${className} text-red-500`} />;
    default:
      return <Activity className={`${className} text-gray-500`} />;
  }
};

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  status?: string;
  trend?: 'up' | 'down' | 'stable';
}> = ({ title, value, subtitle, icon, status, trend }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow"
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-600">{title}</h3>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end space-y-1">
        {status && <StatusIndicator status={status} className="w-5 h-5" />}
        {trend && (
          <div className="flex items-center space-x-1">
            {trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
            {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
            {trend === 'stable' && <BarChart3 className="w-4 h-4 text-blue-500" />}
          </div>
        )}
      </div>
    </div>
  </motion.div>
);

const AlertsList: React.FC<{ alerts: Array<{ level: string; message: string; recommendation?: string }>; title: string }> = ({ alerts, title }) => (
  <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
      <AlertTriangle className="w-5 h-5 mr-2 text-yellow-500" />
      {title}
    </h3>
    {alerts.length === 0 ? (
      <p className="text-gray-500 text-center py-4">No active alerts</p>
    ) : (
      <div className="space-y-3">
        {alerts.map((alert, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`p-3 rounded-lg border-l-4 ${
              alert.level === 'critical' 
                ? 'bg-red-50 border-red-400' 
                : alert.level === 'warning'
                ? 'bg-yellow-50 border-yellow-400'
                : 'bg-blue-50 border-blue-400'
            }`}
          >
            <p className="font-medium text-gray-900">{alert.message}</p>
            {alert.recommendation && (
              <p className="text-sm text-gray-600 mt-1">{alert.recommendation}</p>
            )}
          </motion.div>
        ))}
      </div>
    )}
  </div>
);

const SystemStatusDashboard: React.FC = () => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [databaseHealth, setDatabaseHealth] = useState<DatabaseHealth | null>(null);
  const [cleanupReport, setCleanupReport] = useState<CleanupReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const fetchSystemHealth = async () => {
    try {
      const response = await fetch('/api/admin/system/api/performance');
      if (response.ok) {
        const data = await response.json();
        setSystemHealth(data);
      }
    } catch (error) {
      console.error('Failed to fetch system health:', error);
    }
  };

  const fetchDatabaseHealth = async () => {
    try {
      const response = await fetch('/api/admin/system/database/health');
      if (response.ok) {
        const data = await response.json();
        setDatabaseHealth(data);
      }
    } catch (error) {
      console.error('Failed to fetch database health:', error);
    }
  };

  const fetchCleanupReport = async () => {
    try {
      const response = await fetch('/api/admin/system/cleanup/scan');
      if (response.ok) {
        const data = await response.json();
        setCleanupReport(data);
      }
    } catch (error) {
      console.error('Failed to fetch cleanup report:', error);
    }
  };

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchSystemHealth(),
      fetchDatabaseHealth(),
      fetchCleanupReport()
    ]);
    setLastRefresh(new Date());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await refreshAll();
      setLoading(false);
    };

    loadData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshAll, 30000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading system status...</p>
        </div>
      </div>
    );
  }

  const overallStatus = 
    (systemHealth?.status === 'critical' || databaseHealth?.status === 'critical') ? 'critical' :
    (systemHealth?.status === 'warning' || databaseHealth?.status === 'warning') ? 'warning' : 'healthy';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <StatusIndicator status={overallStatus} className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">System Status Dashboard</h1>
              <p className="text-gray-600">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </p>
            </div>
          </div>
          
          <button
            onClick={refreshAll}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Overview Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="API Status"
            value={systemHealth?.status.toUpperCase() || 'UNKNOWN'}
            subtitle={`${systemHealth?.summary.total_endpoints || 0} endpoints`}
            icon={<Activity className="w-6 h-6" />}
            status={systemHealth?.status}
          />
          
          <MetricCard
            title="Database Status"
            value={databaseHealth?.status.toUpperCase() || 'UNKNOWN'}
            subtitle={`${databaseHealth?.pool_stats.utilization || '0%'} pool usage`}
            icon={<Database className="w-6 h-6" />}
            status={databaseHealth?.status}
          />
          
          <MetricCard
            title="Response Time"
            value={systemHealth?.summary.average_response_time || '0ms'}
            subtitle="Average last hour"
            icon={<Clock className="w-6 h-6" />}
          />
          
          <MetricCard
            title="Success Rate"
            value={systemHealth?.summary.overall_success_rate || '0%'}
            subtitle={`${systemHealth?.summary.total_requests_last_hour || 0} requests`}
            icon={<TrendingUp className="w-6 h-6" />}
          />
        </div>

        {/* API Performance Section */}
        {systemHealth && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Zap className="w-5 h-5 mr-2 text-blue-500" />
                Slowest Endpoints
              </h3>
              {systemHealth.top_slow_endpoints.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No slow endpoints detected</p>
              ) : (
                <div className="space-y-3">
                  {systemHealth.top_slow_endpoints.map((endpoint, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{endpoint.endpoint}</p>
                        <p className="text-sm text-gray-600">{endpoint.requests} requests</p>
                      </div>
                      <span className="text-orange-600 font-semibold">{endpoint.avg_response_time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <XCircle className="w-5 h-5 mr-2 text-red-500" />
                Highest Error Rates
              </h3>
              {systemHealth.top_error_endpoints.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No endpoints with errors</p>
              ) : (
                <div className="space-y-3">
                  {systemHealth.top_error_endpoints.map((endpoint, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{endpoint.endpoint}</p>
                        <p className="text-sm text-gray-600">{endpoint.total_requests} requests</p>
                      </div>
                      <span className="text-red-600 font-semibold">{endpoint.error_rate}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Database Performance Section */}
        {databaseHealth && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <MetricCard
              title="Active Connections"
              value={databaseHealth.performance.active_connections}
              subtitle="Currently processing"
              icon={<Users className="w-6 h-6" />}
            />
            
            <MetricCard
              title="Waiting Connections"
              value={databaseHealth.performance.waiting_connections}
              subtitle="Queued requests"
              icon={<Clock className="w-6 h-6" />}
              status={databaseHealth.performance.waiting_connections > 0 ? 'warning' : 'healthy'}
            />
            
            <MetricCard
              title="Slow Queries"
              value={databaseHealth.performance.slow_queries}
              subtitle="Last hour"
              icon={<Database className="w-6 h-6" />}
              status={databaseHealth.performance.slow_queries > 0 ? 'warning' : 'healthy'}
            />
          </div>
        )}

        {/* Code Quality Section */}
        {cleanupReport && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Code className="w-5 h-5 mr-2 text-green-500" />
              Code Quality Report
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  {cleanupReport.summary.total_files_with_issues}
                </p>
                <p className="text-sm text-gray-600">Files with issues</p>
              </div>
              
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">
                  {Object.values(cleanupReport.summary.category_totals).reduce((a, b) => a + b, 0)}
                </p>
                <p className="text-sm text-gray-600">Total issues</p>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">
                  {cleanupReport.recommendations.length}
                </p>
                <p className="text-sm text-gray-600">Recommendations</p>
              </div>
            </div>

            {cleanupReport.recommendations.length > 0 && (
              <div className="space-y-2">
                {cleanupReport.recommendations.map((recommendation, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-700">{recommendation}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Alerts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {databaseHealth?.alerts && (
            <AlertsList alerts={databaseHealth.alerts} title="Database Alerts" />
          )}
          
          {systemHealth && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-purple-500" />
                Performance Summary
              </h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{systemHealth.alerts.critical}</p>
                  <p className="text-sm text-gray-600">Critical</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-600">{systemHealth.alerts.warning}</p>
                  <p className="text-sm text-gray-600">Warning</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{systemHealth.alerts.info}</p>
                  <p className="text-sm text-gray-600">Info</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recommendations */}
        {databaseHealth?.recommendations && databaseHealth.recommendations.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Settings className="w-5 h-5 mr-2 text-indigo-500" />
              System Recommendations
            </h3>
            
            <div className="space-y-3">
              {databaseHealth.recommendations.map((recommendation, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start space-x-3 p-3 bg-indigo-50 rounded-lg"
                >
                  <CheckCircle className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                  <p className="text-gray-700">{recommendation}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemStatusDashboard;