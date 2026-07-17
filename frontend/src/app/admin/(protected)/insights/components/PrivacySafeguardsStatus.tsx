/**
 * PrivacySafeguardsStatus Component
 * 
 * Displays real-time privacy compliance status:
 * - k-anonymity value and threshold
 * - Differential privacy budget consumption
 * - Consent validation stats
 */

'use client';

import { FiCheck, FiX } from 'react-icons/fi';
import { usePrivacyStatus } from '../hooks/usePrivacyStatus';

export function PrivacySafeguardsStatus() {
  const { status, loading } = usePrivacyStatus();

  if (loading || !status) {
    return (
      <div className="bg-[#00153a]/40 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-white/5 bg-white/5">
          <h2 className="text-xl font-bold text-white tracking-tight">Privacy Safeguards Status</h2>
          <p className="text-xs text-white/50 mt-1 font-mono uppercase tracking-wider">Real-time privacy compliance monitoring</p>
        </div>
        <div className="p-6">
          <div className="animate-pulse grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="h-3 bg-white/20 rounded w-1/2 mb-3"></div>
                <div className="h-8 bg-white/20 rounded w-3/4 mb-3"></div>
                <div className="h-2 bg-white/20 rounded w-full"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const kAnonymityPercent = Math.min((status.k_value / (status.k_threshold * 2)) * 100, 100);
  const epsilonPercent = (status.epsilon_used / status.epsilon_total) * 100;
  const consentPercent = (status.consented_users / status.total_users) * 100;

  const getStatusIcon = (compliant: boolean) =>
    compliant ? (
      <FiCheck className="text-emerald-400" />
    ) : (
      <FiX className="text-red-400" />
    );

  return (
    <div className="bg-[#00153a]/40 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl">
      <div className="p-6 border-b border-white/5 bg-white/5">
        <h2 className="text-xl font-bold text-white tracking-tight">Privacy Safeguards Status</h2>
        <p className="text-xs text-white/50 mt-1 font-mono uppercase tracking-wider">Real-time privacy compliance monitoring</p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* k-anonymity Status */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 relative overflow-hidden group hover:bg-white/10 transition-all">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div className="flex items-center justify-between mb-3 relative z-10">
              <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">k-anonymity</h3>
              {getStatusIcon(status.k_value >= status.k_threshold)}
            </div>
            <p className="text-3xl font-bold text-white relative z-10">k = {status.k_value}</p>
            <p className="text-xs text-white/50 mt-1 font-mono relative z-10">Threshold: k ≥ {status.k_threshold}</p>
            <div className="mt-4 h-1.5 bg-white/10 rounded-full overflow-hidden relative z-10">
              <div
                className={`h-full transition-all duration-500 ease-out ${status.k_value >= status.k_threshold ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                  }`}
                style={{ width: `${Math.min(kAnonymityPercent, 100)}%` }}
              ></div>
            </div>
            {status.k_value < status.k_threshold && (
              <p className="text-xs text-red-400 mt-2 font-medium relative z-10">⚠️ Below threshold - queries blocked</p>
            )}
          </div>

          {/* Differential Privacy Budget */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 relative overflow-hidden group hover:bg-white/10 transition-all">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="flex items-center justify-between mb-3 relative z-10">
              <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Differential Privacy</h3>
              {getStatusIcon(status.epsilon_used < status.epsilon_total)}
            </div>
            <p className="text-3xl font-bold text-white relative z-10">
              ε = {status.epsilon_used.toFixed(2)}<span className="text-lg text-white/40 font-normal">/{status.epsilon_total.toFixed(1)}</span>
            </p>
            <p className="text-xs text-white/50 mt-1 font-mono relative z-10">
              {((1 - epsilonPercent / 100) * 100).toFixed(0)}% budget remaining
            </p>
            <div className="mt-4 h-1.5 bg-white/10 rounded-full overflow-hidden relative z-10">
              <div
                className={`h-full transition-all duration-500 ease-out ${epsilonPercent < 80 ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : epsilonPercent < 95 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                style={{ width: `${epsilonPercent}%` }}
              ></div>
            </div>
            {epsilonPercent >= 95 && (
              <p className="text-xs text-red-400 mt-2 font-medium relative z-10">⚠️ Budget nearly exhausted</p>
            )}
          </div>

          {/* Consent Validation */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 relative overflow-hidden group hover:bg-white/10 transition-all">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex items-center justify-between mb-3 relative z-10">
              <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Consent Validation</h3>
              {getStatusIcon(status.consented_users > 0)}
            </div>
            <p className="text-3xl font-bold text-white relative z-10">
              {status.consented_users} <span className="text-lg text-white/40 font-normal">/ {status.total_users}</span>
            </p>
            <p className="text-xs text-white/50 mt-1 font-mono relative z-10">Active users opted in</p>
            <div className="mt-4 h-1.5 bg-white/10 rounded-full overflow-hidden relative z-10">
              <div
                className="h-full bg-[#FFCA40] shadow-[0_0_10px_rgba(255,202,64,0.5)] transition-all duration-500 ease-out"
                style={{ width: `${consentPercent}%` }}
              ></div>
            </div>
            <p className="text-xs text-white/60 mt-2 font-medium relative z-10">
              {consentPercent.toFixed(1)}% consent rate
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}





