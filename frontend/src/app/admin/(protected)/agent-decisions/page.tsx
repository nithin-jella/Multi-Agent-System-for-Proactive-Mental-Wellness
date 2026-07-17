'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { getAdminAgentDecisions } from '@/services/adminAgentDecisionsApi';
import type { AgentDecisionItem } from '@/types/agentDecisions';

function shortHash(value: string | null): string {
  if (!value) return '-';
  if (value.length < 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function badgeClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === 'confirmed') return 'border-emerald-300/30 bg-emerald-500/10 text-emerald-200';
  if (normalized === 'failed' || normalized === 'dead_letter') return 'border-red-300/30 bg-red-500/10 text-red-200';
  if (normalized === 'awaiting_approval' || normalized === 'approved') return 'border-amber-300/30 bg-amber-500/10 text-amber-200';
  return 'border-white/20 bg-white/10 text-white';
}

export default function AdminAgentDecisionsPage() {
  const [items, setItems] = useState<AgentDecisionItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAdminAgentDecisions(60, 0);
      setItems(response.items);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent decisions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-linear-to-r from-white/10 via-white/5 to-transparent p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Agent Decisions & Attestations</h1>
            <p className="text-sm text-white/70">Transparency view of policy decisions, execution outcomes, and attestation links.</p>
            <p className="mt-1 text-xs text-white/50">Records: <span className="font-medium text-white">{total}</span></p>
          </div>
          <Button onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>
      ) : null}

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-medium text-white">Recent Decisions</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm text-white/90">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/50">
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Policy</th>
                <th className="px-3 py-2">Reasoning</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Attestation</th>
                <th className="px-3 py-2">Tx</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-white/5 align-top">
                  <td className="px-3 py-2 text-xs text-white/70">{item.source}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-white">#{item.id} · {item.action_type}</div>
                    <div className="text-xs text-white/50">risk={item.risk_level} intent={item.intent ?? '-'}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{item.policy_decision}</div>
                    <div className="text-xs text-white/50">next={item.next_step ?? '-'}</div>
                  </td>
                  <td className="max-w-72 px-3 py-2 text-xs text-white/70">
                    <div className="line-clamp-3">{item.agent_reasoning ?? '-'}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-md border px-2 py-1 text-xs ${badgeClass(item.status)}`}>{item.status}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div>record: {item.attestation_record_id ?? '-'}</div>
                    <div className="text-xs text-white/50">status: {item.attestation_status ?? '-'}</div>
                    <div className="text-xs text-white/50">tx: {shortHash(item.attestation_tx_hash)}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{shortHash(item.tx_hash)}</div>
                    {item.explorer_tx_url && item.tx_hash ? (
                      <a
                        href={item.explorer_tx_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center rounded-md border border-[#FFCA40]/40 bg-[#FFCA40]/10 px-2 py-1 text-xs text-[#FFCA40] hover:bg-[#FFCA40]/15"
                      >
                        Open Explorer
                      </a>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-white/70">{formatDate(item.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
