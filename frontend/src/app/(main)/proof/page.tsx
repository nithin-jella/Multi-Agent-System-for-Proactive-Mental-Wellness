"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "react-hot-toast";
import {
  FiActivity,
  FiArrowLeft,
  FiAward,
  FiCheck,
  FiClock,
  FiCopy,
  FiExternalLink,
  FiInfo,
  FiRefreshCw,
  FiShield,
  FiX,
} from "@/icons";

import { listProofActions, type ProofActionItem } from "@/services/proofApi";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type FilterTab = "all" | "confirmed" | "pending" | "failed";

const ACTION_TYPE_LABELS: Record<string, string> = {
  create_checkin: "Check-in Created",
  create_case: "Escalation Case Created",
  mint_badge: "Achievement Badge Minted",
  publish_attestation: "Attestation Published",
};

const POLICY_LABELS: Record<string, string> = {
  allow: "Auto-approved",
  deny: "Blocked",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function humanActionType(raw: string): string {
  return ACTION_TYPE_LABELS[raw] ?? raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanPolicyDecision(raw: string): string {
  return POLICY_LABELS[raw] ?? raw;
}

type ColorSet = { text: string; bg: string; border: string };

function statusStyle(status: string): ColorSet & { label: string } {
  switch (status) {
    case "confirmed":
      return { label: "Confirmed", text: "text-emerald-300", bg: "bg-emerald-400/10", border: "border-emerald-400/30" };
    case "running":
      return { label: "Running", text: "text-blue-300", bg: "bg-blue-400/10", border: "border-blue-400/30" };
    case "queued":
      return { label: "Queued", text: "text-white/60", bg: "bg-white/5", border: "border-white/10" };
    case "failed":
      return { label: "Failed", text: "text-red-300", bg: "bg-red-400/10", border: "border-red-400/30" };
    case "dead_letter":
      return { label: "Dead Letter", text: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/30" };
    default:
      return { label: status, text: "text-white/60", bg: "bg-white/5", border: "border-white/10" };
  }
}

function policyStyle(decision: string): ColorSet {
  switch (decision) {
    case "allow":
      return { text: "text-emerald-300", bg: "bg-emerald-400/10", border: "border-emerald-400/30" };
    case "deny":
      return { text: "text-red-300", bg: "bg-red-400/10", border: "border-red-400/30" };
    default:
      return { text: "text-white/60", bg: "bg-white/5", border: "border-white/10" };
  }
}

function isPending(status: string): boolean {
  return ["queued", "running"].includes(status);
}

function isFailed(status: string): boolean {
  return ["failed", "dead_letter"].includes(status);
}

function matchesFilter(item: ProofActionItem, filter: FilterTab): boolean {
  if (filter === "all") return true;
  if (filter === "confirmed") return item.status === "confirmed";
  if (filter === "pending") return isPending(item.status);
  if (filter === "failed") return isFailed(item.status);
  return true;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TimelineDot({ status }: { status: string }) {
  const style = statusStyle(status);
  let Icon = FiClock;
  if (status === "confirmed") Icon = FiCheck;
  else if (isFailed(status)) Icon = FiX;

  return (
    <div
      className={`relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${style.border} ${style.bg}`}
    >
      <Icon className={`h-4 w-4 ${style.text}`} />
    </div>
  );
}

function TxHashDisplay({
  tx_hash,
  explorer_tx_url,
}: {
  tx_hash: string;
  explorer_tx_url?: string | null;
}) {
  const short = `${tx_hash.slice(0, 10)}...${tx_hash.slice(-8)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tx_hash);
      toast.success("Transaction hash copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="rounded-lg bg-white/5 px-3 py-1.5 font-mono text-xs text-white/60">
        {short}
      </code>
      <button
        onClick={handleCopy}
        title="Copy full transaction hash"
        className="rounded-lg border border-white/10 p-1.5 text-white/40 transition hover:border-white/30 hover:text-white"
      >
        <FiCopy className="h-3.5 w-3.5" />
      </button>
      {explorer_tx_url ? (
        <a
          href={explorer_tx_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300 transition hover:bg-emerald-400/20"
        >
          <FiExternalLink className="h-3.5 w-3.5" />
          View on BSCScan
        </a>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/40">
          <FiShield className="h-3.5 w-3.5" />
          No explorer link
        </span>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex animate-pulse gap-4">
          <div className="mt-1 h-8 w-8 shrink-0 rounded-full bg-white/10" />
          <div className="flex-1 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex gap-2">
              <div className="h-5 w-20 rounded-full bg-white/10" />
              <div className="h-5 w-24 rounded-full bg-white/10" />
            </div>
            <div className="h-5 w-48 rounded bg-white/10" />
            <div className="h-3 w-64 rounded bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProofInfoModal
// ---------------------------------------------------------------------------

function CopyableAddress({ address, label }: { address: string; label: string }) {
  const short = `${address.slice(0, 10)}...${address.slice(-8)}`;
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success("Address copied");
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs text-white/50">{label}</span>
      <code className="rounded bg-white/5 px-2 py-1 font-mono text-xs text-white/60">{short}</code>
      <button onClick={handleCopy} className="rounded p-1 text-white/40 transition hover:text-white">
        <FiCopy className="h-3.5 w-3.5" />
      </button>
      <a
        href={`https://testnet.bscscan.com/address/${address}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
      >
        BSCScan <FiExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

function ProofInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#001D58]/90 shadow-2xl backdrop-blur-xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#001D58]/95 px-6 py-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/10">
              <FiShield className="h-4 w-4 text-emerald-400" />
            </div>
            <h2 className="text-base font-semibold text-white">How Proof Works</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 p-2 text-white/50 transition hover:border-white/30 hover:text-white"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">

          {/* Section 1 — Proof Timeline */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <FiActivity className="h-4 w-4 text-[#FFCA40]" />
              <h3 className="text-sm font-semibold uppercase tracking-widest text-[#FFCA40]/80">
                Proof Timeline
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-white/70">
              Every consequential action that Aika takes — creating an escalation case, minting a
              badge, publishing an attestation — passes through a policy engine before
              it executes. This page records the entire lifecycle of each action:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-white/60">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 rounded-full border border-white/10 bg-white/5 px-1.5 py-px text-[10px] text-white/40 shrink-0">1</span>
                <span><span className="text-white/80">Queued</span> — Aika decides an action is warranted and submits it.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-1.5 py-px text-[10px] text-emerald-400 shrink-0">2</span>
                <span><span className="text-white/80">Policy evaluated</span> — Actions are automatically allowed or denied based on action type and risk level.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-1.5 py-px text-[10px] text-emerald-400 shrink-0">3</span>
                <span><span className="text-white/80">Executed &amp; confirmed</span> — Allowed actions run, and the transaction hash is stored permanently.</span>
              </li>
            </ul>
            <p className="mt-3 text-sm text-white/50">
              The timeline is your personal audit log. It shows what Aika did, why it was allowed,
              and where it landed onchain.
            </p>
          </section>

          <div className="border-t border-white/10" />

          {/* Section 2 — Attestation System */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <FiShield className="h-4 w-4 text-sky-400" />
              <h3 className="text-sm font-semibold uppercase tracking-widest text-sky-400/80">
                Attestation System
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-white/70">
              When a confirmed autopilot action carries real-world consequences — like creating a
              counseling case for a student in distress — it writes an immutable attestation record
              to <span className="font-mono text-xs text-white/80">BSCAttestationRegistry.sol</span> on BSC Testnet.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Each attestation captures: the action type, the authorizing policy decision, a
              timestamp, and who (human or system) approved it. Because these records live on a
              public blockchain, they cannot be modified or deleted after the fact. Anyone can
              verify that a specific AI decision occurred, exactly when it occurred.
            </p>
            <p className="mt-3 text-sm text-white/50">
              This addresses a real concern with autonomous AI systems acting on behalf of
              vulnerable users: accountability. The attestation ledger makes Aika&apos;s decisions
              auditable well beyond the lifetime of this application.
            </p>
            <div className="mt-4 rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-3">
              <p className="text-xs font-medium text-sky-300">BSCAttestationRegistry.sol</p>
              <CopyableAddress
                address="0x6F91e908833FcECEbAdFEEC5Ee6576916E34e09F"
                label="BSC Testnet (Chain ID 97)"
              />
            </div>
          </section>

          <div className="border-t border-white/10" />

          {/* Section 3 — Badge System */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <FiAward className="h-4 w-4 text-[#FFCA40]" />
              <h3 className="text-sm font-semibold uppercase tracking-widest text-[#FFCA40]/80">
                Achievement Badges
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-white/70">
              Wellness milestones are minted as ERC1155 NFTs to your connected wallet via
              <span className="font-mono text-xs text-white/80"> UGMJournalBadges.sol</span>.
              Unlike points or streaks that live inside this app, these are tokens you actually own
              — transferable, verifiable, and permanent on BSC Testnet regardless of whether this
              platform continues to exist.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                { category: "Streaks", items: ["3-day streak", "7-day streak", "14-day streak", "30-day streak"] },
                { category: "Journaling", items: ["First journal entry", "25 entries milestone", "Long-form entry (500+ words)"] },
                { category: "Engagement", items: ["First Aika session", "Extended chat session (20+ messages)"] },
                { category: "Onboarding", items: ["First activity completed"] },
              ].map((group) => (
                <div key={group.category} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <p className="mb-2 text-xs font-semibold text-[#FFCA40]/70">{group.category}</p>
                  <ul className="space-y-1">
                    {group.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-xs text-white/60">
                        <FiCheck className="h-3 w-3 shrink-0 text-emerald-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-white/50">
              To see your badges, go to <span className="text-white/70">Dashboard → Achievements → &quot;Sync badges&quot;</span>. Your wallet must be connected and linked to your account.
            </p>
            <div className="mt-4 rounded-xl border border-[#FFCA40]/20 bg-[#FFCA40]/5 px-4 py-3">
              <p className="text-xs font-medium text-[#FFCA40]">UGMJournalBadges.sol (ERC1155)</p>
              <CopyableAddress
                address="0x8c251c055BC712246392C8229e5ad95859c48AFe"
                label="BSC Testnet (Chain ID 97)"
              />
            </div>
          </section>

        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProofPage() {
  const [items, setItems] = useState<ProofActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await listProofActions({ limit: 100 });
      setItems(response.items);
    } catch {
      toast.error("Failed to load proof timeline.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      confirmed: items.filter((i) => i.status === "confirmed").length,
      pending: items.filter((i) => isPending(i.status)).length,
      failed: items.filter((i) => isFailed(i.status)).length,
    }),
    [items],
  );

  const filtered = useMemo(
    () => items.filter((i) => matchesFilter(i, filter)),
    [items, filter],
  );

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: items.length },
    { key: "confirmed", label: "Confirmed", count: counts.confirmed },
    { key: "pending", label: "Pending", count: counts.pending },
    { key: "failed", label: "Failed", count: counts.failed },
  ];

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto max-w-4xl space-y-8 px-4 pb-16 pt-24">

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-widest text-[#FFCA40]/70">
              Onchain Verification
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-white">Proof Timeline</h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-white/60">
              Every consequential action Aika takes is recorded here as it moves through the
              policy engine. Confirmed entries carry a live transaction hash on BSC Testnet.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsInfoOpen(true)}
              title="How does this work?"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300 transition hover:bg-emerald-400/20"
            >
              <FiInfo className="h-4 w-4" />
              How it works
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:border-[#FFCA40] hover:text-[#FFCA40] disabled:opacity-40"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:border-[#FFCA40] hover:text-[#FFCA40]"
            >
              <FiArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
          </div>
        </div>

        {/* Info modal */}
        <AnimatePresence>
          {isInfoOpen && <ProofInfoModal onClose={() => setIsInfoOpen(false)} />}
        </AnimatePresence>

        {/* Stats row */}
        {!loading && items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-3 gap-3"
          >
            {[
              { label: "Confirmed", value: counts.confirmed, text: "text-emerald-300", card: "border-emerald-400/20 bg-emerald-400/5" },
              { label: "Pending", value: counts.pending, text: "text-yellow-300", card: "border-yellow-400/20 bg-yellow-400/5" },
              { label: "Failed", value: counts.failed, text: "text-red-300", card: "border-red-400/20 bg-red-400/5" },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`rounded-2xl border p-4 text-center ${stat.card}`}
              >
                <p className={`text-2xl font-bold ${stat.text}`}>{stat.value}</p>
                <p className="mt-0.5 text-xs text-white/50">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                filter === tab.key
                  ? "border-[#FFCA40]/40 bg-[#FFCA40]/10 text-[#FFCA40]"
                  : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/80"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs ${
                    filter === tab.key
                      ? "bg-[#FFCA40]/20 text-[#FFCA40]"
                      : "bg-white/10 text-white/50"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <Skeleton />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 py-16 text-center">
            <FiActivity className="mx-auto mb-3 h-10 w-10 text-white/20" />
            <p className="text-sm text-white/50">
              {filter === "all"
                ? "No autopilot actions yet. Aika will record actions here as she works."
                : `No ${filter} actions.`}
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical connector */}
            <div className="absolute bottom-0 left-3.5 top-8 z-0 w-px bg-white/10" />

            <div className="space-y-0">
              {filtered.map((item, idx) => {
                const status = statusStyle(item.status);
                const policy = policyStyle(item.policy_decision);

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.25 }}
                    className="flex gap-4 pb-6"
                  >
                    <TimelineDot status={item.status} />

                    <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/[0.07]">
                      {/* Badges row */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.bg} ${status.border} ${status.text}`}
                          >
                            {status.label}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs ${policy.bg} ${policy.border} ${policy.text}`}
                          >
                            {humanPolicyDecision(item.policy_decision)}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-white/40">
                            Risk: {item.risk_level}
                          </span>
                        </div>
                        <p className="text-xs text-white/30">#{item.id}</p>
                      </div>

                      {/* Action type */}
                      <p className="mt-3 text-base font-semibold text-white">
                        {humanActionType(item.action_type)}
                      </p>

                      {/* Timestamps */}
                      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-white/40">
                        <span>Queued {new Date(item.created_at).toLocaleString()}</span>
                        {item.executed_at && (
                          <span>· Executed {new Date(item.executed_at).toLocaleString()}</span>
                        )}
                      </div>

                      {/* Tx hash */}
                      {item.tx_hash && (
                        <div className="mt-4">
                          <TxHashDisplay
                            tx_hash={item.tx_hash}
                            explorer_tx_url={item.explorer_tx_url}
                          />
                        </div>
                      )}

                      {/* Approval notes */}
                      {item.approval_notes && (
                        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60">
                          <span className="font-medium text-white/80">Review note: </span>
                          {item.approval_notes}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
