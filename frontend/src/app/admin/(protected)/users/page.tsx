"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Download, UserPlus, Eye, Mail, ExternalLink, RefreshCw, BarChart2, ShieldAlert, AlertTriangle, Phone } from 'lucide-react';
import { apiCall } from '@/utils/adminApi';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import Link from 'next/link';
import { User, UsersResponse, UserLog, UserStats } from '@/types/admin/users';
import { getScreeningDashboard, listScreeningProfiles } from '@/services/adminScreeningApi';
import { ScreeningDashboard, ScreeningProfile, RISK_CONFIG, RiskLevel } from '@/types/admin/screening';
import UserProfileDrawer from '@/components/admin/UserProfileDrawer';

// Mock types to cover any missing ones in this simplified version
const ITEMS_PER_PAGE = 20;

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeOnly, setActiveOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState<'id' | 'last_activity_date' | 'current_streak' | 'sentiment_score'>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Drawer & Selection
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [screeningDashboard, setScreeningDashboard] = useState<ScreeningDashboard | null>(null);
  const [screeningProfilesMap, setScreeningProfilesMap] = useState<Record<number, ScreeningProfile>>({});

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        sort_by: sortBy,
        sort_order: sortOrder,
        ...(searchQuery && { search: searchQuery }),
        ...(roleFilter && { role: roleFilter }),
        ...(activeOnly && { is_active: 'true' })
      }).toString();

      const [usersData, sdData, spData] = await Promise.all([
        apiCall(`/api/v1/admin/users?${queryParams}`) as Promise<UsersResponse>,
        getScreeningDashboard().catch(() => null),
        listScreeningProfiles({ limit: 1000 }).catch(() => null)
      ]);

      setUsers(usersData.users);
      setStats(usersData.stats);
      setTotalCount(usersData.total_count);

      if (sdData) setScreeningDashboard(sdData);

      if (spData) {
        const pMap: Record<number, ScreeningProfile> = {};
        spData.profiles.forEach((p: ScreeningProfile) => {
          pMap[p.user_id] = p;
        });
        setScreeningProfilesMap(pMap);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load user and screening data');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, roleFilter, activeOnly, sortBy, sortOrder]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchUsers();
  };

  const handleTableSort = (field: 'id' | 'last_activity_date' | 'current_streak' | 'sentiment_score') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
    // Let useCallback dependency trigger refetch
  };

  const toggleUserStatus = async (userId: number, currentStatus: boolean) => {
    try {
      if (!confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this user?`)) return;

      await apiCall(`/api/v1/admin/users/${userId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !currentStatus })
      });
      toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update user status');
    }
  };

  const updateUserRole = async (userId: number, newRole: string) => {
    try {
      if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;

      await apiCall(`/api/v1/admin/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole })
      });
      toast.success(`User role updated to ${newRole}`);
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update user role');
    }
  };

  const toggleEmailCheckins = async (userId: number, allow: boolean) => {
    try {
      await apiCall(`/api/v1/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ allow_email_checkins: allow })
      });
      toast.success(`Email check-ins ${allow ? 'enabled' : 'disabled'}`);
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update email check-in preferences');
    }
  };

  const deleteUser = async (userId: number, permanent = false) => {
    try {
      if (!confirm(`Are you absolutely sure you want to ${permanent ? 'PERMANENTLY DELETE' : 'soft delete'} user ${userId}? ${permanent ? 'This cannot be undone!' : ''}`)) return;

      const endpoint = permanent
        ? `/api/v1/admin/users/${userId}?permanent=true`
        : `/api/v1/admin/users/${userId}`;

      await apiCall(endpoint, { method: 'DELETE' });
      toast.success(`User ${permanent ? 'permanently deleted' : 'deleted'}`);

      if (selectedUser?.id === userId) {
        setIsDrawerOpen(false);
      }
      fetchUsers();
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  const resetUserPassword = async (userId: number) => {
    try {
      if (!confirm(`Generate a temporary password for user ${userId}? They will be forced to change it on next login.`)) return;

      const response = await apiCall<{ temp_password?: string }>(`/api/v1/admin/users/${userId}/reset-password`, {
        method: 'POST'
      });

      // In a real app we might email this to them, but for admin we can show it
      toast.success(`Password reset to: ${response.temp_password || 'temporary123'}`, { duration: 10000 });
    } catch (error) {
      toast.error('Failed to reset password');
    }
  };

  const handleExport = () => {
    // Basic CSV export of current page data
    const csvContent = [
      ['ID', 'Name', 'Email', 'Role', 'Status', 'Joined', 'Last Active', 'Streak', 'Sentiment'],
      ...users.map(u => [
        u.id,
        u.name || '',
        u.email || '',
        u.role,
        u.is_active ? 'Active' : 'Inactive',
        u.created_at,
        u.last_activity_date || '',
        u.current_streak,
        u.sentiment_score
      ])
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const getSentimentColor = (score: number) => {
    if (score >= 0.7) return 'text-green-400 bg-green-500/10 border-green-500/20';
    if (score >= 0.3) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    if (score > -0.3) return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    if (score > -0.7) return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
    return 'text-red-400 bg-red-500/10 border-red-500/20';
  };

  const formatWhatsAppLink = (phone: string | undefined | null, name: string) => {
    if (!phone) return '#';
    const cleanPhone = phone.replace(/\D/g, '');
    let finalPhone = cleanPhone;
    if (cleanPhone.startsWith('08')) {
      finalPhone = '62' + cleanPhone.substring(1);
    }
    const message = encodeURIComponent(`Hello ${name || ''}, this is the Admin from UGM-AICare.`);
    return `https://wa.me/${finalPhone}?text=${message}`;
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Command Center</h1>
          <p className="text-gray-400 mt-1">Unified User, CRM & Screening Dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchUsers()}
            className="p-2 bg-white/5 border border-white/10 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin text-[#FFCA40]' : ''}`} />
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Purpose-Driven Data Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Total Monitored Users</p>
              <h3 className="text-3xl font-bold text-white mt-1">{stats?.total_users || 0}</h3>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <BarChart2 className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-green-400 font-medium">+{stats?.new_7d || 0}</span>
            <span className="text-gray-400 ml-2">new users this week</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-red-500/10 to-transparent backdrop-blur-sm border border-red-500/20 rounded-xl p-5"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Requires Attention</p>
              <h3 className="text-3xl font-bold text-red-500 mt-1">{screeningDashboard?.profiles_requiring_attention || 0}</h3>
            </div>
            <div className="p-3 bg-red-500/20 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-gray-300">Across screening signals</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">High Risk Profiles</p>
              <h3 className="text-3xl font-bold text-orange-400 mt-1">
                {(screeningDashboard?.risk_distribution['critical'] || 0) + (screeningDashboard?.risk_distribution['severe'] || 0)}
              </h3>
            </div>
            <div className="p-3 bg-orange-500/10 rounded-lg">
              <ShieldAlert className="w-6 h-6 text-orange-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-orange-400">{screeningDashboard?.risk_distribution['critical'] || 0} Critical</span>
            <span className="text-gray-400 mx-2">•</span>
            <span className="text-yellow-400">{screeningDashboard?.risk_distribution['severe'] || 0} Severe</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Engagement Health</p>
              <h3 className="text-3xl font-bold text-green-400 mt-1">{stats?.active_users_7d || 0}</h3>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg">
              <RefreshCw className="w-6 h-6 text-green-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-400">
            Active users within the last 7 days
          </div>
        </motion.div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
        <form onSubmit={handleSearch} className="flex-1 w-full relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFCA40] focus:border-transparent transition-all"
          />
        </form>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors ${showFilters || roleFilter || activeOnly
              ? 'bg-[#FFCA40]/20 border-[#FFCA40]/50 text-[#FFCA40]'
              : 'bg-black/20 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
          >
            <Filter className="h-4 w-4" /> Filters
            {(roleFilter || activeOnly) && (
              <span className="w-2 h-2 rounded-full bg-[#FFCA40] ml-1"></span>
            )}
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex gap-6 items-center flex-wrap">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Role</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-black/20 border border-white/10 rounded-md text-sm text-white px-3 py-1.5 focus:ring-[#FFCA40]"
                >
                  <option value="">All Roles</option>
                  <option value="user">User</option>
                  <option value="counselor">Counselor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex items-center mt-5">
                <input
                  type="checkbox"
                  id="activeOnly"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                  className="h-4 w-4 text-[#FFCA40] focus:ring-[#FFCA40] bg-white/10 border-white/20 rounded"
                />
                <label htmlFor="activeOnly" className="ml-2 text-sm text-gray-300">
                  Active users only
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Users Master Table */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/20">
            <thead className="bg-white/5">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">User Profile</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Access & Role</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Screening Risk</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Engagement</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">CRM Output</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-transparent divide-y divide-white/10">
              {users.map((user) => {
                const sp = screeningProfilesMap[user.id];
                const riskConfig = sp ? RISK_CONFIG[sp.overall_risk] : null;

                return (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors cursor-pointer" onClick={async () => {
                    setDrawerLoading(true);
                    setIsDrawerOpen(true);
                    try {
                      const fullUserDetails: User = await apiCall(`/api/v1/admin/users/${user.id}`);
                      setSelectedUser(fullUserDetails);
                    } catch (error) {
                      toast.error('Failed to load user details');
                    } finally {
                      setDrawerLoading(false);
                    }
                  }}>
                    {/* User Identity Column */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="relative h-10 w-10 text-white rounded-full border border-white/20 bg-white/10 shrink-0 overflow-hidden">
                          {user.avatar_url ? (
                            <Image src={user.avatar_url} alt="Avatar" fill className="object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[#FFCA40] font-bold">
                              {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-bold text-white">{user.name || `User ${user.id}`}</div>
                          <div className="text-xs text-white/50">{user.email || 'No email provided'}</div>
                        </div>
                      </div>
                    </td>

                    {/* Access & Role */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1.5 items-start">
                        <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-white/10 text-white/70 border border-white/20 uppercase">
                          {user.role}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${user.is_active ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>

                    {/* Screening Risk */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {sp ? (
                        <div className="flex flex-col items-start gap-1">
                          <span className={`inline-flex px-2 py-1 text-xs font-bold rounded-full border ${riskConfig?.bgColor} ${riskConfig?.color} ${riskConfig?.borderColor}`}>
                            {sp.requires_attention && <AlertTriangle className="w-3 h-3 mr-1" />}
                            {riskConfig?.label}
                          </span>
                          <span className="text-[10px] text-white/40 font-mono">
                            Traj: <span className={sp.risk_trajectory === 'improving' ? 'text-green-400' : sp.risk_trajectory === 'declining' ? 'text-red-400' : 'text-blue-400 uppercase'}>{sp.risk_trajectory}</span>
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-white/30 italic">No Data</span>
                      )}
                    </td>

                    {/* Engagement Tracker */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <div className={`inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold uppercase rounded border border-white/10 bg-white/5 tooltip relative group`}>
                          {user.current_streak} Day Streak
                        </div>
                        <div className={`inline-flex px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${getSentimentColor(user.sentiment_score)}`}>
                          Sentiment {(user.sentiment_score * 100).toFixed(0)}%
                        </div>
                      </div>
                    </td>

                    {/* CRM Contact */}
                    <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2.5">
                        {user.phone ? (
                          <a href={formatWhatsAppLink(user.phone, user.name || 'User')} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-[#25D366]/20 text-[#25D366] rounded-md hover:bg-[#25D366]/30 transition-colors border border-[#25D366]/30">
                            <Phone className="w-4 h-4" />
                          </a>
                        ) : (
                          <div className="p-1.5 bg-white/5 text-white/20 rounded-md border border-white/10">
                            <Phone className="w-4 h-4" />
                          </div>
                        )}
                        <a href={`mailto:${user.email}`} className="p-1.5 bg-blue-500/10 text-blue-400 rounded-md hover:bg-blue-500/20 transition-colors border border-blue-500/20">
                          <Mail className="w-4 h-4" />
                        </a>
                      </div>
                    </td>

                    {/* Actions Menu */}
                    <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      <select
                        onChange={(e) => {
                          const action = e.target.value;
                          e.target.value = '';

                          switch (action) {
                            case 'toggle-status':
                              toggleUserStatus(user.id, user.is_active ?? true);
                              break;
                            case 'make-admin':
                              updateUserRole(user.id, 'admin');
                              break;
                            case 'make-counselor':
                              updateUserRole(user.id, 'counselor');
                              break;
                            case 'make-user':
                              updateUserRole(user.id, 'user');
                              break;
                            case 'reset-password':
                              resetUserPassword(user.id);
                              break;
                            case 'delete':
                              deleteUser(user.id, false);
                              break;
                            case 'delete-permanent':
                              deleteUser(user.id, true);
                              break;
                          }
                        }}
                        className="bg-black/40 text-white text-xs border border-white/20 rounded pl-2 pr-6 py-1.5 hover:bg-black/60 focus:outline-none focus:border-[#FFCA40] cursor-pointer"
                      >
                        <option value="">Actions...</option>
                        <option value="toggle-status">{user.is_active ? 'Deactivate' : 'Activate'}</option>
                        <option value="make-admin">Make Admin</option>
                        <option value="make-counselor">Make Counselor</option>
                        <option value="make-user">Make User</option>
                        <option value="reset-password">Reset Password</option>
                        <option value="delete">Deactivate</option>
                        <option value="delete-permanent">Delete Permanently</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Header (Optional padding bottom) */}
        {totalPages > 1 && (
          <div className="bg-white/5 px-4 py-3 border-t border-white/20 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-400">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount} users
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-sm rounded-md transition-colors disabled:opacity-50"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                if (page <= 0) return null;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded-md text-sm transition-colors ${page === currentPage ? 'bg-[#FFCA40] text-black font-bold' : 'bg-white/5 text-white hover:bg-white/10'
                      }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-sm rounded-md transition-colors disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <UserProfileDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        screeningProfile={selectedUser ? screeningProfilesMap[selectedUser.id] : null}
        isLoading={drawerLoading}
      />
    </div>
  );
}
