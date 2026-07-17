'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import BadgesTab from '@/components/admin/blockchain/BadgesTab';
import { getAdminContractsStatus } from '@/services/adminContractsApi';
import type { AdminContractStatusItem, AdminContractsStatusResponse } from '@/types/admin/contracts';
import { getAttestationMonitor } from '@/services/adminAttestationApi';
import type {
  AttestationContractTelemetry,
  AttestationMonitorResponse,
  AttestationRecordItem,
  PublishActionItem,
} from '@/types/admin/attestationMonitor';

// --- Shared Helper Components & Functions ---
function shortAddress(value: string | null): string {
  if (!value) return '-';
  if (value.length < 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function shortHash(value: string | null, left = 8, right = 6): string {
  if (!value) return '-';
  if (value.length <= left + right + 3) return value;
  return `${value.slice(0, left)}...${value.slice(-right)}`;
}

function formatDateTime(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatSeconds(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '-';
  if (value < 60) return `${value.toFixed(1)}s`;
  return `${(value / 60).toFixed(1)}m`;
}

function statusText(status: string): string {
  return status.replaceAll('_', ' ').toUpperCase();
}

function txExplorerUrl(chainId: number | null, txHash: string | null, explorerMap: Record<number, string>): string | null {
  if (!chainId || !txHash) {
    return null;
  }
  const base = explorerMap[chainId];
  if (!base) {
    return null;
  }
  return `${base}/tx/${txHash}`;
}

function statusBadge(ready: boolean, configured: boolean): string {
  if (!configured) return 'NOT CONFIGURED';
  if (ready) return 'READY';
  return 'DEGRADED';
}

function StatusClass(ready: boolean, configured: boolean): string {
  if (!configured) return 'text-amber-200 border-amber-200/30 bg-amber-500/10';
  if (ready) return 'text-emerald-200 border-emerald-200/30 bg-emerald-500/10';
  return 'text-red-200 border-red-200/30 bg-red-500/10';
}

function NetworkBadge({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={`${name} logo`}
          width={16}
          height={16}
          unoptimized
          className="h-4 w-4 rounded-full object-cover"
          loading="lazy"
          onError={(event) => {
            const target = event.currentTarget as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      ) : null}
      <span className="text-xs text-white/80">{name}</span>
    </div>
  );
}

function HeaderWithTooltip({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <div className="inline-flex items-center gap-1">
      <span>{label}</span>
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/20 text-[10px] text-white/70"
        title={tooltip}
        aria-label={tooltip}
      >
        i
      </span>
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#00153A] p-4">
      <p className="text-xs uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-white/60">{hint}</p> : null}
    </div>
  );
}

// --- Contract Health Tab Specific Components ---
function ErrorModal({
  item,
  onClose,
}: {
  item: AdminContractStatusItem | null;
  onClose: () => void;
}) {
  if (!item) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-white/15 bg-[#000c24] p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Contract Error Detail</h3>
            <p className="mt-1 text-xs text-white/60">{item.name} · {item.network}</p>
          </div>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>

        <div className="grid grid-cols-1 gap-3 text-xs text-white/70 md:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-[#00153A] p-3">
            <p className="text-white/50">Contract Address</p>
            <p className="mt-1 break-all text-white">{item.contract_address ?? '-'}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#00153A] p-3">
            <p className="text-white/50">Publisher Address</p>
            <p className="mt-1 break-all text-white">{item.publisher_address ?? '-'}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#00153A] p-3">
            <p className="text-white/50">RPC Connectivity</p>
            <p className="mt-1 text-white">{item.rpc_connected ? 'Connected' : 'Disconnected'}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#00153A] p-3">
            <p className="text-white/50">Readiness</p>
            <p className="mt-1 text-white">{statusBadge(item.is_ready, item.is_configured)}</p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-red-200/80">Error Message</p>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap wrap-break-word text-sm text-red-100">
            {item.last_error ?? 'No error details available.'}
          </pre>
        </div>

        {Object.keys(item.details ?? {}).length > 0 ? (
          <div className="mt-4 rounded-lg border border-white/10 bg-[#00153A] p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-white/60">Additional Details</p>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap wrap-break-word text-xs text-white/75">
              {JSON.stringify(item.details, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ContractsTable({
  items,
  loading,
  onOpenError,
}: {
  items: AdminContractStatusItem[];
  loading: boolean;
  onOpenError: (item: AdminContractStatusItem) => void;
}) {
  if (!loading && items.length === 0) {
    return <p className="mt-3 text-sm text-white/60">No contracts found in this category.</p>;
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="min-w-full text-sm text-white/90">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/50">
            <th className="px-3 py-2"><HeaderWithTooltip label="Contract" tooltip="Contract name and category tracked by admin monitoring." /></th>
            <th className="px-3 py-2"><HeaderWithTooltip label="Network" tooltip="Blockchain network where this contract is expected to run (with chain id)." /></th>
            <th className="px-3 py-2"><HeaderWithTooltip label="Address" tooltip="Deployed contract address. Click to open explorer address page when available." /></th>
            <th className="px-3 py-2"><HeaderWithTooltip label="Publisher" tooltip="Wallet used by backend for privileged contract actions (mint/publish)." /></th>
            <th className="px-3 py-2"><HeaderWithTooltip label="RPC" tooltip="Current connectivity status to the configured RPC endpoint." /></th>
            <th className="px-3 py-2"><HeaderWithTooltip label="Status" tooltip="Readiness derived from configuration presence plus live RPC/contract accessibility." /></th>
            <th className="px-3 py-2"><HeaderWithTooltip label="Error" tooltip="Latest backend error while checking or using this contract. Click to view full details." /></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.key} className="border-b border-white/5 align-top transition-colors hover:bg-white/10">
              <td className="px-3 py-2">
                <div className="font-medium text-white">{item.name}</div>
                <div className="text-xs text-white/50">{item.category}</div>
              </td>
              <td className="px-3 py-2">
                <NetworkBadge name={item.network} logoUrl={item.network_logo_url} />
                <div className="text-xs text-white/50">{item.chain_id ? `Chain ${item.chain_id}` : '-'}</div>
              </td>
              <td className="px-3 py-2">
                {item.contract_address ? (
                  item.explorer_base_url ? (
                    <a
                      href={`${item.explorer_base_url}/address/${item.contract_address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#FFCA40] hover:underline"
                    >
                      {shortAddress(item.contract_address)}
                    </a>
                  ) : (
                    shortAddress(item.contract_address)
                  )
                ) : (
                  '-'
                )}
              </td>
              <td className="px-3 py-2">{shortAddress(item.publisher_address)}</td>
              <td className="px-3 py-2">{item.rpc_connected ? 'Connected' : 'Disconnected'}</td>
              <td className="px-3 py-2">
                <span className={`rounded-md border px-2 py-1 text-xs ${StatusClass(item.is_ready, item.is_configured)}`}>
                  {statusBadge(item.is_ready, item.is_configured)}
                </span>
              </td>
              <td className="max-w-65 truncate px-3 py-2 text-xs text-white/60" title={item.last_error ?? ''}>
                {item.last_error ? (
                  <button
                    onClick={() => onOpenError(item)}
                    className="rounded-md border border-red-300/30 bg-red-500/10 px-2 py-1 text-xs text-red-200 hover:bg-red-500/20"
                  >
                    View Error
                  </button>
                ) : (
                  '-'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContractHealthTab() {
  const [data, setData] = useState<AdminContractsStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorModalItem, setErrorModalItem] = useState<AdminContractStatusItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAdminContractsStatus();
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load smart contract status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const items = data?.contracts ?? [];
    return {
      token: items.filter((item) => item.category === 'token'),
      badge: items.filter((item) => item.category === 'badge'),
      attestation: items.filter((item) => item.category === 'attestation'),
    };
  }, [data]);

  const totalContracts = data?.contracts.length ?? 0;
  const readyContracts = (data?.contracts ?? []).filter((item) => item.is_ready).length;
  const degradedContracts = (data?.contracts ?? []).filter((item) => item.is_configured && !item.is_ready).length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-linear-to-r from-[#FFCA40]/15 via-[#00153A] to-transparent p-5 shadow-lg shadow-black/20">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Smart Contracts</h2>
            <p className="text-sm text-white/70">Monitor contract readiness, RPC health, and publisher wallet state across supported chains.</p>
            <p className="mt-1 text-xs text-white/50">
              Overall status: <span className="font-medium text-white">{data?.status ?? '-'}</span>
            </p>
          </div>
          <Button onClick={load} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Tracked Contracts" value={String(totalContracts)} hint="Token, badge, and attestation registries" />
        <MetricCard label="Ready" value={String(readyContracts)} hint="Fully configured and connected" />
        <MetricCard label="Degraded" value={String(degradedContracts)} hint="Configured but not currently ready" />
      </section>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-medium text-white">Registry Status Tables</h3>
          <p className="text-sm text-white/60">Click contract addresses to open explorer pages when available.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-white/10 bg-[#00153A] p-4 shadow-lg shadow-black/15">
        <h3 className="text-lg font-medium text-white">Attestation Registries</h3>
        <ContractsTable items={grouped.attestation} loading={loading} onOpenError={setErrorModalItem} />
      </section>

      <section className="rounded-xl border border-white/10 bg-[#00153A] p-4 shadow-lg shadow-black/15">
        <h3 className="text-lg font-medium text-white">Badge Registries</h3>
        <ContractsTable items={grouped.badge} loading={loading} onOpenError={setErrorModalItem} />
      </section>

      <section className="rounded-xl border border-white/10 bg-[#00153A] p-4 shadow-lg shadow-black/15">
        <h3 className="text-lg font-medium text-white">Token Contracts</h3>
        <ContractsTable items={grouped.token} loading={loading} onOpenError={setErrorModalItem} />
      </section>

      <ErrorModal item={errorModalItem} onClose={() => setErrorModalItem(null)} />
    </div>
  );
}

// --- Attestation Monitor Tab Specific Components ---
function getCounterConsistency(item: AttestationContractTelemetry): {
  label: string;
  className: string;
  detail: string;
} {
  if (item.last_onchain_read_error) {
    return {
      label: 'ON-CHAIN READ ERROR',
      className: 'border-red-400/40 bg-red-500/10 text-red-200',
      detail: 'Cannot compare counters until RPC reads recover.',
    };
  }

  if (item.onchain_publisher_published === null) {
    return {
      label: 'UNKNOWN',
      className: 'border-white/20 bg-[#00153A] text-white/70',
      detail: 'On-chain publisher counter not available.',
    };
  }

  const delta = item.publish_successes - item.onchain_publisher_published;
  if (delta === 0) {
    return {
      label: 'ALIGNED',
      className: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
      detail: 'Backend success count matches on-chain publisher count.',
    };
  }

  return {
    label: delta > 0 ? 'BACKEND AHEAD' : 'ON-CHAIN AHEAD',
    className: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
    detail: `Counter delta: ${Math.abs(delta)}.`,
  };
}

function ContractRow({ item }: { item: AttestationContractTelemetry }) {
  const readiness = item.is_ready ? 'READY' : item.rpc_connected ? 'DEGRADED' : 'OFFLINE';
  const consistency = getCounterConsistency(item);

  return (
    <tr className="border-b border-white/5 align-top transition-colors hover:bg-white/10">
      <td className="px-3 py-2">
        <NetworkBadge name={item.network} logoUrl={item.network_logo_url} />
        <div className="text-xs text-white/50">Chain {item.chain_id}</div>
      </td>
      <td className="px-3 py-2">
        {item.contract_address && item.explorer_base_url ? (
          <a
            href={`${item.explorer_base_url}/address/${item.contract_address}`}
            target="_blank"
            rel="noreferrer"
            className="text-[#FFCA40] hover:underline"
          >
            {shortHash(item.contract_address, 10, 6)}
          </a>
        ) : (
          shortHash(item.contract_address)
        )}
      </td>
      <td className="px-3 py-2">{shortHash(item.publisher_address)}</td>
      <td className="px-3 py-2">{readiness}</td>
      <td className="px-3 py-2">
        {item.publish_successes} / {item.publish_attempts}
      </td>
      <td className="px-3 py-2">{item.publish_failures}</td>
      <td className="px-3 py-2">{item.onchain_publisher_published ?? '-'}</td>
      <td className="px-3 py-2">{item.onchain_total_published ?? '-'}</td>
      <td className="px-3 py-2">{formatDateTime(item.last_publish_success_at)}</td>
      <td className="px-3 py-2">{formatDateTime(item.onchain_last_published_at)}</td>
      <td className="px-3 py-2">
        <span className={`inline-flex rounded-md border px-2 py-1 text-xs ${consistency.className}`}>
          {consistency.label}
        </span>
        <div className="mt-1 text-xs text-white/60">{consistency.detail}</div>
      </td>
      <td className="max-w-52 truncate px-3 py-2 text-xs text-white/60" title={item.last_error ?? ''}>
        {item.last_error ?? '-'}
      </td>
      <td className="max-w-52 truncate px-3 py-2 text-xs text-white/60" title={item.last_onchain_read_error ?? ''}>
        {item.last_onchain_read_error ?? '-'}
      </td>
    </tr>
  );
}

function RecordsTable({ records, explorerMap }: { records: AttestationRecordItem[]; explorerMap: Record<number, string> }) {
  if (records.length === 0) {
    return <p className="text-sm text-white/60">No attestation records available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-white/90">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/50">
            <th className="px-3 py-2">Record</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Counselor</th>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2">Processed</th>
            <th className="px-3 py-2">Tx Hash</th>
            <th className="px-3 py-2">Error</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className="border-b border-white/5 align-top transition-colors hover:bg-white/10">
              <td className="px-3 py-2">
                <div>#{record.id}</div>
                <div className="text-xs text-white/50">Attestation {shortHash(record.attestation_id)}</div>
              </td>
              <td className="px-3 py-2">{statusText(record.status)}</td>
              <td className="px-3 py-2">{record.counselor_id}</td>
              <td className="px-3 py-2">{formatDateTime(record.created_at)}</td>
              <td className="px-3 py-2">{formatDateTime(record.processed_at)}</td>
              <td className="px-3 py-2">
                <div>{shortHash(record.tx_hash)}</div>
                {txExplorerUrl(record.chain_id, record.tx_hash, explorerMap) ? (
                  <a
                    href={txExplorerUrl(record.chain_id, record.tx_hash, explorerMap) ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center rounded-md border border-[#FFCA40]/40 bg-[#FFCA40]/10 px-2 py-1 text-xs text-[#FFCA40] hover:bg-[#FFCA40]/15"
                  >
                    Open Explorer
                  </a>
                ) : null}
              </td>
              <td className="max-w-52 truncate px-3 py-2 text-xs text-white/60" title={record.last_error ?? ''}>
                {record.last_error ?? '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionsTable({ actions, explorerMap }: { actions: PublishActionItem[]; explorerMap: Record<number, string> }) {
  if (actions.length === 0) {
    return <p className="text-sm text-white/60">No publish actions available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-white/90">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/50">
            <th className="px-3 py-2">Action</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Retries</th>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2">Executed</th>
            <th className="px-3 py-2">Tx Hash</th>
            <th className="px-3 py-2">Error</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((action) => (
            <tr key={action.id} className="border-b border-white/5 align-top transition-colors hover:bg-white/10">
              <td className="px-3 py-2">
                <div>#{action.id}</div>
                <div className="text-xs text-white/50">Record {action.attestation_record_id ?? '-'}</div>
              </td>
              <td className="px-3 py-2">{statusText(action.status)}</td>
              <td className="px-3 py-2">{action.retry_count}</td>
              <td className="px-3 py-2">{formatDateTime(action.created_at)}</td>
              <td className="px-3 py-2">{formatDateTime(action.executed_at)}</td>
              <td className="px-3 py-2">
                <div>{shortHash(action.tx_hash)}</div>
                {txExplorerUrl(action.chain_id, action.tx_hash, explorerMap) ? (
                  <a
                    href={txExplorerUrl(action.chain_id, action.tx_hash, explorerMap) ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center rounded-md border border-[#FFCA40]/40 bg-[#FFCA40]/10 px-2 py-1 text-xs text-[#FFCA40] hover:bg-[#FFCA40]/15"
                  >
                    Open Explorer
                  </a>
                ) : null}
              </td>
              <td className="max-w-52 truncate px-3 py-2 text-xs text-white/60" title={action.error_message ?? ''}>
                {action.error_message ?? '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AttestationMonitorTab() {
  const [data, setData] = useState<AttestationMonitorResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAttestationMonitor(20);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attestation monitor');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const queueHealthText = useMemo(() => {
    if (!data) return '-';
    const { publish_queue: queue } = data;
    if (queue.total === 0) return 'No queued publish actions yet';
    return `${queue.confirmed} confirmed · ${queue.failed + queue.dead_letter} failed/dead-letter · ${queue.queued + queue.running + queue.approved} in progress`;
  }, [data]);

  const consistencySummary = useMemo(() => {
    const counters = data?.contracts ?? [];
    const withCounters = counters.filter((item) => item.onchain_publisher_published !== null && !item.last_onchain_read_error);
    const mismatched = withCounters.filter((item) => item.publish_successes !== item.onchain_publisher_published).length;
    const readErrors = counters.filter((item) => Boolean(item.last_onchain_read_error)).length;

    if (counters.length === 0) {
      return 'No contract telemetry available yet.';
    }

    return `${mismatched} mismatch(es), ${withCounters.length - mismatched} aligned network(s), ${readErrors} RPC read error network(s).`;
  }, [data]);

  const explorerMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (const contract of data?.contracts ?? []) {
      if (contract.chain_id && contract.explorer_base_url) {
        map[contract.chain_id] = contract.explorer_base_url;
      }
    }
    return map;
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-linear-to-r from-white/10 via-[#00153A] to-transparent p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Attestation Monitor</h2>
            <p className="text-sm text-white/70">Operational view for counselor attestations from queue creation to on-chain publication.</p>
            <p className="mt-1 text-xs text-white/50">Last update: {formatDateTime(data?.generated_at ?? null)}</p>
          </div>
          <Button onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</Button>
        </div>
      </div>

      <section className="rounded-xl border border-white/10 bg-[#00153A] p-4">
        <h3 className="text-lg font-medium text-white">What this attestation means</h3>
        <div className="mt-2 space-y-2 text-sm text-white/70">
          <p>An attestation is a counselor-issued proof that a specific intervention or quest milestone happened. The system stores hashed payload evidence on-chain, while sensitive counseling context stays off-chain.</p>
          <p>Flow: counselor action creates attestation record → autopilot queues publish action → worker submits tx to BSC attestation registry → record is confirmed with tx hash and chain metadata.</p>
          <p>The contract telemetry table compares backend-pipeline counters with direct on-chain counters to reveal drifts, stale workers, or RPC read failures.</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Attestations" value={String(data?.counts.total ?? 0)} hint="All records in attestation ledger" />
        <MetricCard label="Confirmed" value={String(data?.counts.confirmed ?? 0)} hint={`${data?.success_rate_percent ?? 0}% success rate`} />
        <MetricCard label="Pending + Queued" value={String((data?.counts.pending ?? 0) + (data?.counts.queued ?? 0))} hint="Not published yet" />
        <MetricCard label="Average Confirmation" value={formatSeconds(data?.avg_confirmation_seconds ?? null)} hint="Created to processed time" />
      </section>

      <section className="rounded-xl border border-white/10 bg-[#00153A] p-4">
        <h3 className="text-lg font-medium text-white">Publish Queue Health</h3>
        <p className="mt-1 text-sm text-white/60">{queueHealthText}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="Queued" value={String(data?.publish_queue.queued ?? 0)} />
          <MetricCard label="Approved" value={String(data?.publish_queue.approved ?? 0)} />
          <MetricCard label="Running" value={String(data?.publish_queue.running ?? 0)} />
          <MetricCard label="Confirmed" value={String(data?.publish_queue.confirmed ?? 0)} />
          <MetricCard label="Failed" value={String(data?.publish_queue.failed ?? 0)} />
          <MetricCard label="Dead Letter" value={String(data?.publish_queue.dead_letter ?? 0)} />
        </div>
      </section>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">Telemetry & Logs</h3>
          <p className="text-sm text-white/60">Lifecycle logs and registry-level counters.</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>
      ) : null}

      <section className="rounded-xl border border-white/10 bg-[#00153A] p-4">
        <h3 className="text-lg font-medium text-white">Contract Publisher Telemetry (Backend vs On-chain)</h3>
        <p className="mt-1 text-sm text-white/60">{consistencySummary}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm text-white/90">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/50">
                <th className="px-3 py-2">Network</th>
                <th className="px-3 py-2">Contract</th>
                <th className="px-3 py-2">Publisher</th>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2">Backend Success / Attempts</th>
                <th className="px-3 py-2">Backend Failures</th>
                <th className="px-3 py-2">On-chain Publisher Count</th>
                <th className="px-3 py-2">On-chain Total</th>
                <th className="px-3 py-2">Last Backend Success</th>
                <th className="px-3 py-2">Last On-chain Publish</th>
                <th className="px-3 py-2">Consistency</th>
                <th className="px-3 py-2">Pipeline Error</th>
                <th className="px-3 py-2">On-chain Read Error</th>
              </tr>
            </thead>
            <tbody>
              {(data?.contracts ?? []).map((item) => (
                <ContractRow key={`${item.chain_id}-${item.short_name}`} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-[#00153A] p-4">
        <h3 className="text-lg font-medium text-white">Recent Attestation Records</h3>
        <div className="mt-3">
          <RecordsTable records={data?.recent_records ?? []} explorerMap={explorerMap} />
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-[#00153A] p-4">
        <h3 className="text-lg font-medium text-white">Recent Publish Actions</h3>
        <div className="mt-3">
          <ActionsTable actions={data?.recent_publish_actions ?? []} explorerMap={explorerMap} />
        </div>
      </section>
    </div>
  );
}

// --- Main Page Component ---
export default function AdminBlockchainPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams?.get('tab');
  const defaultTab: 'contracts' | 'attestations' | 'badges' =
    initialTab === 'attestations' || initialTab === 'badges' || initialTab === 'contracts'
      ? initialTab
      : 'contracts';

  const [activeTab, setActiveTab] = useState<'contracts' | 'attestations' | 'badges'>(defaultTab);
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set([defaultTab]));

  const switchTab = (tab: 'contracts' | 'attestations' | 'badges') => {
    setActiveTab(tab);
    setMountedTabs((prev) => {
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', tab);
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 border-b border-white/10 pb-4">
        <h1 className="text-3xl font-semibold text-white">Blockchain</h1>
        <p className="text-sm text-white/60">Monitor smart contract health and attestation operations.</p>
      </div>

      <div className="flex flex-wrap gap-6 border-b border-white/10">
        <button
          onClick={() => switchTab('contracts')}
          className={`pb-3 text-sm font-medium transition-colors ${
            activeTab === 'contracts'
              ? 'border-b-2 border-[#FFCA40] text-[#FFCA40]'
              : 'border-b-2 border-transparent text-white/60 hover:text-white'
          }`}
        >
          Contract Health
        </button>
        <button
          onClick={() => switchTab('attestations')}
          className={`pb-3 text-sm font-medium transition-colors ${
            activeTab === 'attestations'
              ? 'border-b-2 border-[#FFCA40] text-[#FFCA40]'
              : 'border-b-2 border-transparent text-white/60 hover:text-white'
          }`}
        >
          Attestation Monitor
        </button>
        <button
          onClick={() => switchTab('badges')}
          className={`pb-3 text-sm font-medium transition-colors ${
            activeTab === 'badges'
              ? 'border-b-2 border-[#FFCA40] text-[#FFCA40]'
              : 'border-b-2 border-transparent text-white/60 hover:text-white'
          }`}
        >
          EDU Badges
        </button>
      </div>

      <div className="mt-6">
        {mountedTabs.has('contracts') && (
          <div className={activeTab === 'contracts' ? 'block' : 'hidden'}>
            <ContractHealthTab />
          </div>
        )}
        {mountedTabs.has('attestations') && (
          <div className={activeTab === 'attestations' ? 'block' : 'hidden'}>
            <AttestationMonitorTab />
          </div>
        )}
        {mountedTabs.has('badges') && (
          <div className={activeTab === 'badges' ? 'block' : 'hidden'}>
            <BadgesTab />
          </div>
        )}
      </div>
    </div>
  );
}
