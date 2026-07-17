'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Textarea } from '@/components/ui/TextArea';
import { useI18n } from '@/i18n/I18nProvider';
import { getIpfsUrl } from '@/lib/badgeConstants';
import { adminBadgesApi } from '@/services/adminBadgesApi';
import type { BadgeIssuance, BadgeTemplate, BadgeTemplateStatus, ChainInfo } from '@/types/admin/badges';

const AUTO_AWARD_ACTION_OPTIONS = [
  'manual_sync',
  'journal_saved',
  'quest_completed',
  'wellness_state_updated',
] as const;

function formatTimestamp(ts?: string | null): string {
  if (!ts) return '-';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}

function statusClass(status: BadgeTemplateStatus): string {
  if (status === 'PUBLISHED') return 'border-emerald-300/30 bg-emerald-500/10 text-emerald-200';
  if (status === 'ARCHIVED') return 'border-white/20 bg-white/10 text-white/70';
  return 'border-amber-300/30 bg-amber-500/10 text-amber-200';
}

export default function BadgesTab() {
  const { t } = useI18n();

  const [templates, setTemplates] = useState<BadgeTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [chains, setChains] = useState<ChainInfo[]>([]);
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>(undefined);

  const [activeTemplate, setActiveTemplate] = useState<BadgeTemplate | null>(null);

  const [issuances, setIssuances] = useState<BadgeIssuance[]>([]);
  const [isIssuancesOpen, setIsIssuancesOpen] = useState(false);

  const [isMintOpen, setIsMintOpen] = useState(false);
  const [mintUserId, setMintUserId] = useState('');
  const [mintAmount, setMintAmount] = useState('1');

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const [newTokenId, setNewTokenId] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newAutoAwardEnabled, setNewAutoAwardEnabled] = useState(false);
  const [newAutoAwardAction, setNewAutoAwardAction] = useState('');
  const [newAutoAwardCriteria, setNewAutoAwardCriteria] = useState('');

  const [editAutoAwardEnabled, setEditAutoAwardEnabled] = useState(false);
  const [editAutoAwardAction, setEditAutoAwardAction] = useState('');
  const [editAutoAwardCriteria, setEditAutoAwardCriteria] = useState('');

  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rows, chainList] = await Promise.all([
        adminBadgesApi.listTemplates(),
        adminBadgesApi.listChains(),
      ]);
      setTemplates(rows);
      setChains(chainList);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`${t('admin.badges.load_failed', 'Failed to load badges')}: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const canCreate = useMemo(() => {
    const tokenId = Number.parseInt(newTokenId, 10);
    return Number.isFinite(tokenId) && tokenId >= 0 && newName.trim().length > 0;
  }, [newTokenId, newName]);

  const templateCounts = useMemo(() => {
    const draft = templates.filter((item) => item.status === 'DRAFT').length;
    const published = templates.filter((item) => item.status === 'PUBLISHED').length;
    return { total: templates.length, draft, published };
  }, [templates]);

  const onCreate = useCallback(async () => {
    const tokenId = Number.parseInt(newTokenId, 10);
    if (!Number.isFinite(tokenId) || tokenId < 0) {
      toast.error(t('admin.badges.invalid_token_id', 'Invalid token id'));
      return;
    }
    if (!newName.trim()) {
      toast.error(t('admin.badges.invalid_name', 'Name is required'));
      return;
    }

    let parsedCriteria: Record<string, unknown> | undefined;
    if (newAutoAwardEnabled) {
      if (!newAutoAwardAction.trim()) {
        toast.error('Auto-award action is required when auto-award is enabled');
        return;
      }
      if (!newAutoAwardCriteria.trim()) {
        toast.error('Auto-award criteria JSON is required when auto-award is enabled');
        return;
      }
      try {
        const parsed = JSON.parse(newAutoAwardCriteria);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          toast.error('Auto-award criteria must be a JSON object');
          return;
        }
        parsedCriteria = parsed as Record<string, unknown>;
      } catch {
        toast.error('Invalid auto-award criteria JSON');
        return;
      }
    }

    try {
      await adminBadgesApi.createTemplate({
        token_id: tokenId,
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        chain_id: selectedChainId,
        auto_award_enabled: newAutoAwardEnabled,
        auto_award_action: newAutoAwardEnabled ? newAutoAwardAction.trim() : undefined,
        auto_award_criteria: newAutoAwardEnabled ? parsedCriteria : undefined,
      });
      toast.success(t('admin.badges.created', 'Badge draft created'));
      setNewTokenId('');
      setNewName('');
      setNewDescription('');
      setNewAutoAwardEnabled(false);
      setNewAutoAwardAction('');
      setNewAutoAwardCriteria('');
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`${t('admin.badges.create_failed', 'Create failed')}: ${msg}`);
    }
  }, [
    newAutoAwardAction,
    newAutoAwardCriteria,
    newAutoAwardEnabled,
    newDescription,
    newName,
    newTokenId,
    refresh,
    selectedChainId,
    t,
  ]);

  const requestUpload = useCallback((templateId: number) => {
    fileInputs.current[templateId]?.click();
  }, []);

  const onUpload = useCallback(
    async (template: BadgeTemplate, file: File | null) => {
      if (!file) return;
      try {
        await adminBadgesApi.uploadImage(template.id, file);
        toast.success(t('admin.badges.image_uploaded', 'Image uploaded'));
        await refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`${t('admin.badges.upload_failed', 'Upload failed')}: ${msg}`);
      }
    },
    [refresh, t]
  );

  const onPublish = useCallback(
    async (template: BadgeTemplate) => {
      try {
        const res = await adminBadgesApi.publish(template.id);
        const tx = res.set_token_uri_tx_hash;
        toast.success(
          tx
            ? `${t('admin.badges.published', 'Published')} (tx: ${tx.slice(0, 10)}...)`
            : t('admin.badges.published', 'Published')
        );
        await refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`${t('admin.badges.publish_failed', 'Publish failed')}: ${msg}`);
      }
    },
    [refresh, t]
  );

  const openMint = useCallback((template: BadgeTemplate) => {
    setActiveTemplate(template);
    setMintUserId('');
    setMintAmount('1');
    setIsMintOpen(true);
  }, []);

  const openEdit = useCallback((template: BadgeTemplate) => {
    setActiveTemplate(template);
    setEditName(template.name);
    setEditDescription(template.description ?? '');
    setEditAutoAwardEnabled(Boolean(template.auto_award_enabled));
    setEditAutoAwardAction(template.auto_award_action ?? '');
    setEditAutoAwardCriteria(template.auto_award_criteria ? JSON.stringify(template.auto_award_criteria, null, 2) : '');
    setIsEditOpen(true);
  }, []);

  const submitEdit = useCallback(async () => {
    if (!activeTemplate) return;
    if (!editName.trim()) {
      toast.error(t('admin.badges.invalid_name', 'Name is required'));
      return;
    }

    let parsedCriteria: Record<string, unknown> | null = null;
    if (editAutoAwardEnabled) {
      if (!editAutoAwardAction.trim()) {
        toast.error('Auto-award action is required when auto-award is enabled');
        return;
      }
      if (!editAutoAwardCriteria.trim()) {
        toast.error('Auto-award criteria JSON is required when auto-award is enabled');
        return;
      }
      try {
        const parsed = JSON.parse(editAutoAwardCriteria);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          toast.error('Auto-award criteria must be a JSON object');
          return;
        }
        parsedCriteria = parsed as Record<string, unknown>;
      } catch {
        toast.error('Invalid auto-award criteria JSON');
        return;
      }
    }

    try {
      await adminBadgesApi.updateTemplate(activeTemplate.id, {
        name: editName.trim(),
        description: editDescription.trim() ? editDescription.trim() : null,
        auto_award_enabled: editAutoAwardEnabled,
        auto_award_action: editAutoAwardEnabled ? editAutoAwardAction.trim() : null,
        auto_award_criteria: editAutoAwardEnabled ? parsedCriteria : null,
      });
      toast.success(t('admin.badges.updated', 'Badge updated'));
      setIsEditOpen(false);
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`${t('admin.badges.update_failed', 'Update failed')}: ${msg}`);
    }
  }, [
    activeTemplate,
    editAutoAwardAction,
    editAutoAwardCriteria,
    editAutoAwardEnabled,
    editDescription,
    editName,
    refresh,
    t,
  ]);

  const submitMint = useCallback(async () => {
    if (!activeTemplate) return;
    const userId = Number.parseInt(mintUserId, 10);
    const amount = Number.parseInt(mintAmount, 10);
    if (!Number.isFinite(userId) || userId <= 0) {
      toast.error(t('admin.badges.invalid_user_id', 'Invalid user id'));
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(t('admin.badges.invalid_amount', 'Invalid amount'));
      return;
    }
    try {
      const issuance = await adminBadgesApi.mint(activeTemplate.id, { user_id: userId, amount });
      toast.success(
        issuance.tx_hash
          ? `${t('admin.badges.mint_sent', 'Mint sent')} (tx: ${issuance.tx_hash.slice(0, 10)}...)`
          : t('admin.badges.mint_sent', 'Mint sent')
      );
      setIsMintOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`${t('admin.badges.mint_failed', 'Mint failed')}: ${msg}`);
    }
  }, [activeTemplate, mintAmount, mintUserId, t]);

  const openIssuances = useCallback(
    async (template: BadgeTemplate) => {
      setActiveTemplate(template);
      setIsIssuancesOpen(true);
      setIssuances([]);
      try {
        const res = await adminBadgesApi.listIssuances(template.id);
        setIssuances(res.issuances);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`${t('admin.badges.issuances_failed', 'Failed to load issuances')}: ${msg}`);
      }
    },
    [t]
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="rounded-2xl border border-white/10 bg-linear-to-r from-white/10 via-white/5 to-transparent p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">{t('admin.badges.title', 'EDU Badges')}</h2>
            <p className="mt-1 text-sm text-white/70">
              {t(
                'admin.badges.subtitle',
                'Simple flow for non-technical admins: create draft, upload image, publish on-chain metadata, then mint to students.'
              )}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center">
              <div className="text-white/60">Total</div>
              <div className="text-lg font-semibold text-white">{templateCounts.total}</div>
            </div>
            <div className="rounded-lg border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-center">
              <div className="text-amber-200/80">Drafts</div>
              <div className="text-lg font-semibold text-amber-200">{templateCounts.draft}</div>
            </div>
            <div className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-center">
              <div className="text-emerald-200/80">Published</div>
              <div className="text-lg font-semibold text-emerald-200">{templateCounts.published}</div>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 text-xs md:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white/80"><span className="font-semibold text-white">1.</span> Create badge draft</div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white/80"><span className="font-semibold text-white">2.</span> Upload badge image</div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white/80"><span className="font-semibold text-white">3.</span> Publish metadata on-chain</div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white/80"><span className="font-semibold text-white">4.</span> Mint badge to student</div>
        </div>
        <div className="mt-4">
          <Button onClick={refresh} disabled={isLoading}>
            {isLoading ? t('admin.badges.loading', 'Loading...') : t('admin.badges.refresh', 'Refresh')}
          </Button>
        </div>
      </div>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium text-white">{t('admin.badges.create_title', 'Add New Badge')}</h3>
          <span className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/70">Step 1</span>
        </div>
        <p className="mt-1 text-sm text-white/60">Fill the basics below, then create the draft. Upload and publish actions are available in the template list.</p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            name="token_id"
            type="number"
            label={t('admin.badges.token_id', 'Token ID')}
            value={newTokenId}
            onChange={(e) => setNewTokenId(e.target.value)}
            placeholder={t('admin.badges.token_id', 'Token ID')}
            aria-label={t('admin.badges.token_id', 'Token ID')}
            className="w-full pl-3 pr-3 py-2 bg-white/8 border border-white/15 rounded-lg text-white"
          />
          <Input
            name="name"
            label={t('admin.badges.name', 'Badge Name')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('admin.badges.name', 'Badge Name')}
            aria-label={t('admin.badges.name', 'Badge Name')}
            className="w-full pl-3 pr-3 py-2 bg-white/8 border border-white/15 rounded-lg text-white"
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="chain_select" className="text-xs font-medium text-white/70">
              {t('admin.badges.chain', 'Target Chain')}
            </label>
            <select
              id="chain_select"
              value={selectedChainId ?? ''}
              onChange={(e) => setSelectedChainId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-sm text-white"
              aria-label={t('admin.badges.chain', 'Target Chain')}
            >
              <option value="">{t('admin.badges.default_chain', 'Default (EDU Chain)')}</option>
              {chains.map((c) => (
                <option key={c.chain_id} value={c.chain_id} disabled={!c.is_ready}>
                  {c.name} {c.is_testnet ? '(testnet)' : ''} {!c.is_ready ? '- not configured' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/70">
            Only chains marked as configured are selectable. If a chain is disabled, complete RPC and contract setup first.
          </div>
        </div>

        <div className="mt-3">
          <Textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder={t('admin.badges.description', 'Description (optional)')}
            aria-label={t('admin.badges.description', 'Description (optional)')}
          />
        </div>

        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
          <label className="flex items-center gap-2 text-sm text-white/80">
            <input
              type="checkbox"
              checked={newAutoAwardEnabled}
              onChange={(e) => setNewAutoAwardEnabled(e.target.checked)}
            />
            Enable auto-award (optional)
          </label>
          {newAutoAwardEnabled ? (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="auto_award_action" className="text-xs font-medium text-white/70">
                  Auto-award action
                </label>
                <select
                  id="auto_award_action"
                  value={newAutoAwardAction}
                  onChange={(e) => setNewAutoAwardAction(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-sm text-white"
                  aria-label="Auto-award action"
                >
                  <option value="">Select trigger event</option>
                  {AUTO_AWARD_ACTION_OPTIONS.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>
              </div>
              <Textarea
                value={newAutoAwardCriteria}
                onChange={(e) => setNewAutoAwardCriteria(e.target.value)}
                placeholder='{"min_journal_count": 5}'
                aria-label="Auto-award criteria JSON"
              />
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={onCreate} disabled={!canCreate} className="min-w-42">
            {t('admin.badges.create', 'Create Draft')}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/5">
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium text-white">{t('admin.badges.list_title', 'Badge Templates')}</h3>
            <span className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/70">Steps 2-4</span>
          </div>
          <p className="mt-1 text-sm text-white/60">For each draft: upload image, publish metadata, then mint badge.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-white/70">
              <tr className="border-b border-white/10">
                <th className="p-3">{t('admin.badges.col.token_id', 'Token')}</th>
                <th className="p-3">{t('admin.badges.col.chain', 'Chain')}</th>
                <th className="p-3">{t('admin.badges.col.name', 'Name')}</th>
                <th className="p-3">{t('admin.badges.col.status', 'Status')}</th>
                <th className="p-3">{t('admin.badges.col.image', 'Image')}</th>
                <th className="p-3">{t('admin.badges.col.metadata', 'Metadata')}</th>
                <th className="p-3">{t('admin.badges.col.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="text-white/80">
              {templates.length === 0 ? (
                <tr>
                  <td className="p-4" colSpan={7}>
                    {t('admin.badges.empty', 'No badge templates yet.')}
                  </td>
                </tr>
              ) : (
                templates.map((tpl) => {
                  const imageUrl = tpl.image_uri ? getIpfsUrl(tpl.image_uri) : null;
                  return (
                    <tr key={tpl.id} className="border-b border-white/5">
                      <td className="p-3">{tpl.token_id}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/80">
                          {tpl.chain_short_name ?? `#${tpl.chain_id}`}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-white">{tpl.name}</div>
                        {tpl.description ? (
                          <div className="line-clamp-2 text-xs text-white/60">{tpl.description}</div>
                        ) : null}
                      </td>
                      <td className="p-3">
                        <div className={`inline-flex rounded-md border px-2 py-1 text-xs ${statusClass(tpl.status)}`}>{tpl.status}</div>
                        {tpl.published_at ? (
                          <div className="text-[11px] text-white/50">{formatTimestamp(tpl.published_at)}</div>
                        ) : null}
                      </td>
                      <td className="p-3">
                        {imageUrl ? (
                          <div className="relative h-12 w-12 overflow-hidden rounded-md border border-white/10">
                            <Image src={imageUrl} alt={tpl.name} fill sizes="48px" className="object-cover" />
                          </div>
                        ) : (
                          <span className="text-xs text-white/40">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        {tpl.metadata_uri ? (
                          <a
                            className="text-xs text-sky-300 hover:underline"
                            href={getIpfsUrl(tpl.metadata_uri)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t('admin.badges.view', 'View')}
                          </a>
                        ) : (
                          <span className="text-xs text-white/40">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {tpl.status === 'DRAFT' ? (
                            <>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={(el) => {
                                  fileInputs.current[tpl.id] = el;
                                }}
                                onChange={(e) => onUpload(tpl, e.target.files?.[0] ?? null)}
                              />
                              <Button variant="secondary" onClick={() => openEdit(tpl)}>
                                1) {t('admin.badges.edit', 'Edit')}
                              </Button>
                              <Button variant="secondary" onClick={() => requestUpload(tpl.id)}>
                                2) {t('admin.badges.upload', 'Upload Image')}
                              </Button>
                              <Button onClick={() => onPublish(tpl)} disabled={!tpl.image_uri}>
                                3) {t('admin.badges.publish', 'Publish')}
                              </Button>
                            </>
                          ) : null}

                          {tpl.status === 'PUBLISHED' ? (
                            <>
                              <Button onClick={() => openMint(tpl)}>4) {t('admin.badges.mint', 'Mint')}</Button>
                              <Button variant="secondary" onClick={() => openIssuances(tpl)}>
                                {t('admin.badges.issuances', 'Issuances')}
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isMintOpen && activeTemplate ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setIsMintOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-white/10 bg-[#000c24] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-white">{t('admin.badges.mint_title', 'Mint badge')}</h3>
            <p className="mt-1 text-sm text-white/60">
              {activeTemplate.name} (token {activeTemplate.token_id})
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                name="user_id"
                type="number"
                label={t('admin.badges.user_id', 'User ID')}
                value={mintUserId}
                onChange={(e) => setMintUserId(e.target.value)}
                placeholder={t('admin.badges.user_id', 'User ID')}
                aria-label={t('admin.badges.user_id', 'User ID')}
                className="w-full pl-3 pr-3 py-2 bg-white/8 border border-white/15 rounded-lg text-white"
              />
              <Input
                name="amount"
                type="number"
                label={t('admin.badges.amount', 'Amount')}
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
                placeholder={t('admin.badges.amount', 'Amount')}
                aria-label={t('admin.badges.amount', 'Amount')}
                className="w-full pl-3 pr-3 py-2 bg-white/8 border border-white/15 rounded-lg text-white"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setIsMintOpen(false)}>
                {t('admin.badges.cancel', 'Cancel')}
              </Button>
              <Button onClick={submitMint}>{t('admin.badges.mint', 'Mint')}</Button>
            </div>
          </div>
        </div>
      ) : null}

      {isEditOpen && activeTemplate ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setIsEditOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-white/10 bg-[#000c24] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-white">{t('admin.badges.edit_title', 'Edit badge draft')}</h3>
            <p className="mt-1 text-sm text-white/60">token {activeTemplate.token_id}</p>

            <div className="mt-4 space-y-3">
              <Input
                name="edit_name"
                label={t('admin.badges.name', 'Name')}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full pl-3 pr-3 py-2 bg-white/8 border border-white/15 rounded-lg text-white"
              />
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder={t('admin.badges.description', 'Description (optional)')}
                aria-label={t('admin.badges.description', 'Description (optional)')}
              />
              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={editAutoAwardEnabled}
                  onChange={(e) => setEditAutoAwardEnabled(e.target.checked)}
                />
                Enable auto-award
              </label>
              {editAutoAwardEnabled ? (
                <>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="edit_auto_award_action" className="text-xs font-medium text-white/70">
                      Auto-award action
                    </label>
                    <select
                      id="edit_auto_award_action"
                      value={editAutoAwardAction}
                      onChange={(e) => setEditAutoAwardAction(e.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-sm text-white"
                    >
                      <option value="">Select action</option>
                      {AUTO_AWARD_ACTION_OPTIONS.map((action) => (
                        <option key={action} value={action}>
                          {action}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Textarea
                    value={editAutoAwardCriteria}
                    onChange={(e) => setEditAutoAwardCriteria(e.target.value)}
                    placeholder='{"min_streak": 7}'
                    aria-label="Auto-award criteria JSON"
                  />
                </>
              ) : null}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setIsEditOpen(false)}>
                {t('admin.badges.cancel', 'Cancel')}
              </Button>
              <Button onClick={submitEdit}>{t('admin.badges.save', 'Save')}</Button>
            </div>
          </div>
        </div>
      ) : null}

      {isIssuancesOpen && activeTemplate ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setIsIssuancesOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-lg border border-white/10 bg-[#000c24] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-medium text-white">{t('admin.badges.issuances_title', 'Issuances')}</h3>
                <p className="mt-1 text-sm text-white/60">
                  {activeTemplate.name} (token {activeTemplate.token_id})
                </p>
              </div>
              <Button variant="secondary" onClick={() => setIsIssuancesOpen(false)}>
                {t('admin.badges.close', 'Close')}
              </Button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-white/70">
                  <tr className="border-b border-white/10">
                    <th className="p-2">{t('admin.badges.col.user_id', 'User')}</th>
                    <th className="p-2">{t('admin.badges.col.wallet', 'Wallet')}</th>
                    <th className="p-2">{t('admin.badges.col.amount', 'Amount')}</th>
                    <th className="p-2">{t('admin.badges.col.chain', 'Chain')}</th>
                    <th className="p-2">{t('admin.badges.col.tx', 'Tx')}</th>
                    <th className="p-2">{t('admin.badges.col.status', 'Status')}</th>
                    <th className="p-2">{t('admin.badges.col.time', 'Time')}</th>
                  </tr>
                </thead>
                <tbody className="text-white/80">
                  {issuances.length === 0 ? (
                    <tr>
                      <td className="p-3" colSpan={7}>
                        {t('admin.badges.no_issuances', 'No issuances yet.')}
                      </td>
                    </tr>
                  ) : (
                    issuances.map((i) => (
                      <tr key={i.id} className="border-b border-white/5">
                        <td className="p-2">{i.user_id}</td>
                        <td className="p-2">
                          <span className="text-xs">{i.wallet_address}</span>
                        </td>
                        <td className="p-2">{i.amount}</td>
                        <td className="p-2">
                          <span className="text-xs text-white/60">
                            {chains.find((c) => c.chain_id === i.chain_id)?.short_name ?? `#${i.chain_id}`}
                          </span>
                        </td>
                        <td className="p-2">
                          {i.tx_hash ? (
                            i.explorer_tx_url ? (
                              <a
                                className="text-xs text-sky-300 hover:underline"
                                href={i.explorer_tx_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {i.tx_hash.slice(0, 12)}...
                              </a>
                            ) : (
                              <span className="text-xs">{i.tx_hash.slice(0, 12)}...</span>
                            )
                          ) : (
                            <span className="text-xs text-white/40">-</span>
                          )}
                        </td>
                        <td className="p-2">{i.status}</td>
                        <td className="p-2">
                          <span className="text-xs">{formatTimestamp(i.created_at)}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
