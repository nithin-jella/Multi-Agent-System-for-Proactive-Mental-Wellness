"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiActivity,
  FiBookOpen,
  FiDatabase,
  FiGrid,
  FiLayers,
  FiPlay,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTerminal,
  FiTrash2,
  FiUsers,
  FiZap,
} from "react-icons/fi";
import toast from "react-hot-toast";

import {
  type AutopilotReplayRequest,
  type FullUserFlowSimulationResponse,
  cleanupTestingData,
  createTestingUser,
  getTestingLogTail,
  listTestingUsers,
  runAutopilotReplay,
  runRQ1BatchTest,
  runRQ2Validation,
  runRQ3Generate,
  runRQ3PrivacyTest,
  seedScreeningProfiles,
  seedTestingDatabase,
  simulateFullUserFlow,
  simulateConversation,
  simulateRealChat,
} from "@/services/adminTestingApi";

type TabKey = "core" | "chat" | "research" | "autopilot" | "logs";

type TerminalEntry = {
  id: string;
  time: string;
  level: "info" | "success" | "error";
  message: string;
};

type AutopilotScenario = "attestation_pipeline" | "case_management" | "mixed_operations";
type AutopilotActionType = "publish_attestation" | "mint_badge" | "create_checkin" | "create_case";
type AutopilotRisk = "none" | "low" | "moderate" | "high" | "critical";

const SCENARIO_PRESETS: Record<AutopilotScenario, { label: string; description: string; actionAType: AutopilotActionType; actionARisk: AutopilotRisk; actionBType: AutopilotActionType; actionBRisk: AutopilotRisk; }> = {
  attestation_pipeline: {
    label: "Attestation Pipeline",
    description: "Simulates attestation publishing with one auto-allowed action and one approval-gated action.",
    actionAType: "publish_attestation",
    actionARisk: "low",
    actionBType: "publish_attestation",
    actionBRisk: "high",
  },
  case_management: {
    label: "Case Management",
    description: "Simulates urgent case creation plus high-risk follow-up check-in requiring governance review.",
    actionAType: "create_case",
    actionARisk: "high",
    actionBType: "create_checkin",
    actionBRisk: "high",
  },
  mixed_operations: {
    label: "Mixed Operations",
    description: "Simulates badge minting and attestation publishing in one replay run.",
    actionAType: "mint_badge",
    actionARisk: "low",
    actionBType: "publish_attestation",
    actionBRisk: "moderate",
  },
};

function nowTime(): string {
  return new Date().toLocaleTimeString();
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

type TestUser = {
  id: number;
  email: string;
  name: string;
  role: string;
};

function parseTestUsers(raw: Array<Record<string, unknown>>): TestUser[] {
  return raw
    .map((item) => ({
      id: Number(item.id),
      email: String(item.email ?? ""),
      name: String(item.name ?? ""),
      role: String(item.role ?? "user"),
    }))
    .filter((item) => Number.isFinite(item.id) && item.id > 0 && item.email.length > 0);
}

export default function AdminTestingPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("core");
  const [terminalEntries, setTerminalEntries] = useState<TerminalEntry[]>([]);
  const [backendLogLines, setBackendLogLines] = useState<string[]>([]);
  const [logContains, setLogContains] = useState("");
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [testUsers, setTestUsers] = useState<TestUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number>(0);
  const [seedUsersCount, setSeedUsersCount] = useState(5);
  const [seedCounselorsCount, setSeedCounselorsCount] = useState(2);
  const [seedAdminsCount, setSeedAdminsCount] = useState(1);
  const [seedScreeningProfilesCount, setSeedScreeningProfilesCount] = useState(12);
  const [seedScreeningAttentionRatio, setSeedScreeningAttentionRatio] = useState(0.35);
  const [seedScreeningIncludeCritical, setSeedScreeningIncludeCritical] = useState(true);
  const [replayTimeoutSeconds, setReplayTimeoutSeconds] = useState(240);
  const [autopilotScenario, setAutopilotScenario] = useState<AutopilotScenario>("attestation_pipeline");
  const [actionAType, setActionAType] = useState<AutopilotActionType>(SCENARIO_PRESETS.attestation_pipeline.actionAType);
  const [actionARisk, setActionARisk] = useState<AutopilotRisk>(SCENARIO_PRESETS.attestation_pipeline.actionARisk);
  const [actionBType, setActionBType] = useState<AutopilotActionType>(SCENARIO_PRESETS.attestation_pipeline.actionBType);
  const [actionBRisk, setActionBRisk] = useState<AutopilotRisk>(SCENARIO_PRESETS.attestation_pipeline.actionBRisk);
  const [autoApproveReplay, setAutoApproveReplay] = useState(true);
  const [replayWaitTimeoutSeconds, setReplayWaitTimeoutSeconds] = useState(90);
  const [replayWaitIntervalSeconds, setReplayWaitIntervalSeconds] = useState(2);
  const [fullFlowMessages, setFullFlowMessages] = useState(
    "Aku ngerasa semuanya berat banget minggu ini\nAku jadi susah tidur dan panik tiap malam\nAku takut aku nggak kuat ngejalanin ini",
  );
  const [latestFullFlowResult, setLatestFullFlowResult] = useState<FullUserFlowSimulationResponse | null>(null);

  const appendTerminal = useCallback((level: TerminalEntry["level"], message: string) => {
    setTerminalEntries((prev) => {
      const next: TerminalEntry[] = [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          time: nowTime(),
          level,
          message,
        },
      ];
      return next.slice(-300);
    });
  }, []);

  const refreshBackendLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      const response = await getTestingLogTail({
        lines: 250,
        contains: logContains || undefined,
      });
      setBackendLogLines(response.lines);
    } catch (error) {
      console.error(error);
      appendTerminal("error", `Failed to fetch backend logs: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoadingLogs(false);
    }
  }, [appendTerminal, logContains]);

  const refreshTestUsers = useCallback(async () => {
    try {
      const response = await listTestingUsers();
      const parsed = parseTestUsers(response.users);
      setTestUsers(parsed);

      setSelectedUserId((current) => {
        if (current > 0 && parsed.some((user) => user.id === current)) {
          return current;
        }
        return parsed[0]?.id ?? 0;
      });

      appendTerminal("info", `Loaded ${parsed.length} test users`);
    } catch (error) {
      console.error(error);
      appendTerminal("error", `Failed to load test users: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }, [appendTerminal]);

  const runAction = useCallback(
    async (name: string, fn: () => Promise<unknown>) => {
      setLoadingAction(name);
      appendTerminal("info", `$ ${name}`);
      try {
        const result = await fn();
        appendTerminal("success", stringify(result));
      } catch (error) {
        console.error(error);
        appendTerminal("error", error instanceof Error ? error.message : "Unknown error");
        toast.error(`${name} failed`);
      } finally {
        setLoadingAction(null);
      }
    },
    [appendTerminal],
  );

  const onSeedDatabase = useCallback(async () => {
    await runAction("seed database", () =>
      seedTestingDatabase({
        users_count: seedUsersCount,
        counselors_count: seedCounselorsCount,
        admins_count: seedAdminsCount,
      }),
    );
    await refreshTestUsers();
  }, [refreshTestUsers, runAction, seedAdminsCount, seedCounselorsCount, seedUsersCount]);

  const onListUsers = useCallback(async () => {
    await runAction("list testing users", async () => {
      const response = await listTestingUsers();
      const parsed = parseTestUsers(response.users);
      setTestUsers(parsed);
      return {
        total: response.total,
        users: parsed,
      };
    });
  }, [runAction]);

  const onSeedScreening = useCallback(async () => {
    await runAction("seed screening profiles", () =>
      seedScreeningProfiles({
        profiles_count: seedScreeningProfilesCount,
        include_critical: seedScreeningIncludeCritical,
        requires_attention_ratio: seedScreeningAttentionRatio,
      }),
    );
  }, [
    runAction,
    seedScreeningAttentionRatio,
    seedScreeningIncludeCritical,
    seedScreeningProfilesCount,
  ]);

  const applyScreeningSeedPreset = useCallback(
    (preset: "balanced" | "elevated" | "critical_demo") => {
      if (preset === "balanced") {
        setSeedScreeningProfilesCount(Math.max(testUsers.length, 12));
        setSeedScreeningAttentionRatio(0.3);
        setSeedScreeningIncludeCritical(false);
        appendTerminal("info", "Applied screening preset: Balanced cohort");
        return;
      }

      if (preset === "elevated") {
        setSeedScreeningProfilesCount(Math.max(testUsers.length, 16));
        setSeedScreeningAttentionRatio(0.5);
        setSeedScreeningIncludeCritical(true);
        appendTerminal("info", "Applied screening preset: Elevated risk cohort");
        return;
      }

      setSeedScreeningProfilesCount(Math.max(testUsers.length, 20));
      setSeedScreeningAttentionRatio(0.75);
      setSeedScreeningIncludeCritical(true);
      appendTerminal("info", "Applied screening preset: Critical-heavy demo cohort");
    },
    [appendTerminal, testUsers.length],
  );

  const onRunRQ1 = useCallback(async () => {
    await runAction("run RQ1 batch test", runRQ1BatchTest);
  }, [runAction]);

  const onCleanup = useCallback(async () => {
    await runAction("cleanup testing data", () =>
      cleanupTestingData({
        delete_all_test_users: true,
        delete_conversations: true,
      }),
    );
    await refreshTestUsers();
  }, [refreshTestUsers, runAction]);

  const onCreateUser = useCallback(
    async (role: "user" | "counselor" | "admin") => {
      await runAction(`create ${role} test user`, () =>
        createTestingUser({
          name: `Testing ${role} ${new Date().toISOString().slice(11, 19)}`,
          role,
          major: role === "user" ? "Teknik Informatika" : undefined,
          year_of_study: role === "user" ? "3" : undefined,
          city: "Yogyakarta",
        }),
      );
      await refreshTestUsers();
    },
    [refreshTestUsers, runAction],
  );

  const onConversationScenario = useCallback(async () => {
    if (!selectedUserId) {
      toast.error("Please select a test user first");
      return;
    }
    await runAction("simulate conversation (STA classification)", () =>
      simulateConversation({
        user_id: selectedUserId,
        auto_classify: true,
        messages: [
          "Aku lagi capek banget sama deadline tugas, rasanya ga sanggup",
          "Tidurku berantakan dan jadi sulit fokus kuliah",
        ],
      }),
    );
  }, [runAction, selectedUserId]);

  const onRealChatScenario = useCallback(async () => {
    if (!selectedUserId) {
      toast.error("Please select a test user first");
      return;
    }
    await runAction("simulate real chat (Aika + STA/TCA)", () =>
      simulateRealChat({
        user_id: selectedUserId,
        user_messages: [
          "Aku merasa gagal terus belakangan ini",
          "Aku jadi cemas tiap malam mikirin skripsi",
          "Bisa bantu aku langkah kecil buat hari ini?",
        ],
        enable_sta: true,
        enable_sca: true,
      }),
    );
  }, [runAction, selectedUserId]);

  const onRunFullUserFlow = useCallback(async () => {
    if (!selectedUserId) {
      toast.error("Please select a test user first");
      return;
    }
    const userMessages = fullFlowMessages
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 20);
    if (userMessages.length === 0) {
      toast.error("Please provide at least one message for simulation");
      return;
    }

    const actionName = "simulate full user flow (chat -> escalation -> assignment)";
    setLoadingAction(actionName);
    appendTerminal("info", `$ ${actionName}`);
    try {
      const result = await simulateFullUserFlow({
        user_id: selectedUserId,
        user_messages: userMessages,
        enable_sta: true,
        enable_sca: true,
      });
      setLatestFullFlowResult(result);
      appendTerminal("success", stringify(result));
    } catch (error) {
      console.error(error);
      appendTerminal("error", error instanceof Error ? error.message : "Unknown error");
      toast.error(`${actionName} failed`);
    } finally {
      setLoadingAction(null);
    }
  }, [appendTerminal, fullFlowMessages, selectedUserId]);

  const onRunRQ2 = useCallback(async () => {
    await runAction("run RQ2 orchestration validation", runRQ2Validation);
  }, [runAction]);

  const onRunRQ3Generate = useCallback(async () => {
    await runAction("run RQ3 coaching generation", runRQ3Generate);
  }, [runAction]);

  const onRunRQ3Privacy = useCallback(async () => {
    await runAction("run RQ3 privacy preservation", runRQ3PrivacyTest);
  }, [runAction]);

  const onRunAutopilotReplay = useCallback(async () => {
    const payload: AutopilotReplayRequest = {
      scenario: autopilotScenario,
      action_a_type: actionAType,
      action_a_risk: actionARisk,
      action_b_type: actionBType,
      action_b_risk: actionBRisk,
      auto_approve: autoApproveReplay,
      wait_timeout_seconds: replayWaitTimeoutSeconds,
      wait_interval_seconds: replayWaitIntervalSeconds,
    };
    await runAction("run autopilot replay", () => runAutopilotReplay(replayTimeoutSeconds, payload));
    await refreshBackendLogs();
  }, [
    actionARisk,
    actionAType,
    actionBRisk,
    actionBType,
    autoApproveReplay,
    autopilotScenario,
    refreshBackendLogs,
    replayTimeoutSeconds,
    replayWaitIntervalSeconds,
    replayWaitTimeoutSeconds,
    runAction,
  ]);

  const applyScenarioPreset = useCallback((scenario: AutopilotScenario) => {
    const preset = SCENARIO_PRESETS[scenario];
    setAutopilotScenario(scenario);
    setActionAType(preset.actionAType);
    setActionARisk(preset.actionARisk);
    setActionBType(preset.actionBType);
    setActionBRisk(preset.actionBRisk);
  }, []);

  useEffect(() => {
    refreshBackendLogs().catch(() => {
      // handled in refresh function
    });
    refreshTestUsers().catch(() => {
      // handled in refresh function
    });
  }, [refreshBackendLogs, refreshTestUsers]);

  useEffect(() => {
    if (!autoRefreshLogs) {
      return;
    }
    const interval = window.setInterval(() => {
      refreshBackendLogs().catch(() => {
        // handled in refresh function
      });
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [autoRefreshLogs, refreshBackendLogs]);

  const loadingLabel = useMemo(() => (loadingAction ? `Running: ${loadingAction}` : "Idle"), [loadingAction]);
  const selectedUser = useMemo(
    () => testUsers.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, testUsers],
  );

  const tabItems: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    { key: "core", label: "Core Data", icon: <FiGrid /> },
    { key: "chat", label: "Chat & Safety", icon: <FiShield /> },
    { key: "research", label: "Research", icon: <FiBookOpen /> },
    { key: "autopilot", label: "Autopilot", icon: <FiZap /> },
    { key: "logs", label: "Logs", icon: <FiTerminal /> },
  ];

  const disabledAction = Boolean(loadingAction);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
              <FiTerminal className="text-[#FFCA40]" />
              Testing Console
            </h1>
            <p className="mt-1 text-sm text-white/70">
              Admin-only testing page to run demonstration flows and capture logs for debugging/reporting.
            </p>
          </div>
          <span className="rounded-md border border-white/15 bg-[#001D58] px-3 py-1 text-xs text-white/80">{loadingLabel}</span>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {tabItems.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
                activeTab === tab.key
                  ? "bg-[#FFCA40]/20 text-[#FFCA40]"
                  : "border border-white/15 text-white/70 hover:border-white/30 hover:text-white"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-white/10 bg-[#001D58]/40 p-3 text-xs text-white/70">
          <div className="flex flex-wrap items-center gap-4">
            <span>
              Selected user: <span className="text-white">{selectedUser ? `${selectedUser.name} (#${selectedUser.id})` : "None"}</span>
            </span>
            <span>
              Test users: <span className="text-white">{testUsers.length}</span>
            </span>
            <span>
              Status: <span className="text-white">{loadingLabel}</span>
            </span>
          </div>
        </div>

        {activeTab === "core" && (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 lg:col-span-2">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/70">Seed & Account Scenarios</h2>
              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="text-xs text-white/60">
                  Users
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={seedUsersCount}
                    onChange={(event) => setSeedUsersCount(Number(event.target.value) || 1)}
                    className="mt-1 w-full rounded-md border border-white/20 bg-[#001D58] px-2 py-1.5 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-white/60">
                  Counselors
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={seedCounselorsCount}
                    onChange={(event) => setSeedCounselorsCount(Number(event.target.value) || 0)}
                    className="mt-1 w-full rounded-md border border-white/20 bg-[#001D58] px-2 py-1.5 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-white/60">
                  Admins
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={seedAdminsCount}
                    onChange={(event) => setSeedAdminsCount(Number(event.target.value) || 0)}
                    className="mt-1 w-full rounded-md border border-white/20 bg-[#001D58] px-2 py-1.5 text-sm text-white"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <button onClick={onSeedDatabase} disabled={disabledAction} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#FFCA40]/20 px-3 py-2 text-sm text-[#FFCA40] disabled:opacity-50"><FiDatabase /> Seed DB</button>
                <button onClick={onListUsers} disabled={disabledAction} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm text-white disabled:opacity-50"><FiUsers /> Refresh Users</button>
                <button onClick={() => onCreateUser("user")} disabled={disabledAction} className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-300 disabled:opacity-50"><FiUsers /> Create Student</button>
                <button onClick={() => onCreateUser("counselor")} disabled={disabledAction} className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-400/30 bg-blue-400/10 px-3 py-2 text-sm text-blue-300 disabled:opacity-50"><FiLayers /> Create Counselor</button>
                <button onClick={() => onCreateUser("admin")} disabled={disabledAction} className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-400/30 bg-purple-400/10 px-3 py-2 text-sm text-purple-300 disabled:opacity-50"><FiShield /> Create Admin</button>
                <button onClick={onCleanup} disabled={disabledAction} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-300 disabled:opacity-50"><FiTrash2 /> Cleanup Test Data</button>
              </div>

              <div className="mt-4 rounded-lg border border-white/10 bg-[#001D58]/35 p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/70">Screening Data Seed</h3>
                <p className="mb-3 text-xs text-white/60">
                  Generates synthetic screening profiles for test students so /admin/screening has realistic risk distribution,
                  concerns, trajectories, and attention flags for demo/testing.
                </p>
                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => applyScreeningSeedPreset("balanced")}
                    disabled={disabledAction}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-300 disabled:opacity-50"
                  >
                    Balanced Cohort
                  </button>
                  <button
                    onClick={() => applyScreeningSeedPreset("elevated")}
                    disabled={disabledAction}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-300 disabled:opacity-50"
                  >
                    Elevated Risk Cohort
                  </button>
                  <button
                    onClick={() => applyScreeningSeedPreset("critical_demo")}
                    disabled={disabledAction}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-xs text-red-300 disabled:opacity-50"
                  >
                    Critical Demo Cohort
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <label className="text-xs text-white/60">
                    Profiles
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={seedScreeningProfilesCount}
                      onChange={(event) => setSeedScreeningProfilesCount(Number(event.target.value) || 1)}
                      className="mt-1 w-full rounded-md border border-white/20 bg-[#001D58] px-2 py-1.5 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs text-white/60">
                    Attention Ratio (0-1)
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={seedScreeningAttentionRatio}
                      onChange={(event) => setSeedScreeningAttentionRatio(Number(event.target.value) || 0)}
                      className="mt-1 w-full rounded-md border border-white/20 bg-[#001D58] px-2 py-1.5 text-sm text-white"
                    />
                  </label>
                  <label className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-[#001D58]/60 px-2 py-2 text-xs text-white/80 sm:mt-5">
                    <input
                      type="checkbox"
                      checked={seedScreeningIncludeCritical}
                      onChange={(event) => setSeedScreeningIncludeCritical(event.target.checked)}
                    />
                    Include critical cases
                  </label>
                </div>

                <div className="mt-3">
                  <button
                    onClick={onSeedScreening}
                    disabled={disabledAction}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-2 text-sm text-fuchsia-300 disabled:opacity-50"
                  >
                    <FiActivity /> Seed Screening Profiles
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/70">Select User</h2>
              <select
                value={selectedUserId || ""}
                onChange={(event) => setSelectedUserId(Number(event.target.value) || 0)}
                className="w-full rounded-md border border-white/20 bg-[#001D58] px-2 py-2 text-sm text-white"
              >
                <option value="">No user selected</option>
                {testUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    #{user.id} {user.name} ({user.role})
                  </option>
                ))}
              </select>
              {selectedUser && (
                <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-2 text-xs text-white/70">
                  <p>Name: <span className="text-white">{selectedUser.name}</span></p>
                  <p>Email: <span className="text-white">{selectedUser.email}</span></p>
                  <p>Role: <span className="text-white">{selectedUser.role}</span></p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "chat" && (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 lg:col-span-2">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/70">Full User Flow Simulation</h2>
              <p className="mb-3 text-xs text-white/60">
                Runs one end-to-end flow: simulate chat, inspect AI response, verify escalation, check assigned counselor, and confirm counselor visibility.
              </p>
              <label className="text-xs text-white/60">
                User messages (one line = one chat turn)
                <textarea
                  rows={5}
                  value={fullFlowMessages}
                  onChange={(event) => setFullFlowMessages(event.target.value)}
                  className="mt-1 w-full rounded-md border border-white/20 bg-[#001D58] px-2 py-2 text-sm text-white"
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={onRunFullUserFlow} disabled={disabledAction} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#FFCA40]/30 bg-[#FFCA40]/15 px-3 py-2 text-sm text-[#FFCA40] disabled:opacity-50"><FiZap /> Run Full User Flow</button>
                <button onClick={onRealChatScenario} disabled={disabledAction} className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300 disabled:opacity-50"><FiPlay /> Real Chat Only</button>
                <button onClick={onConversationScenario} disabled={disabledAction} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white disabled:opacity-50"><FiSearch /> STA Classification Only</button>
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/70">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/70">Validation Checklist</h2>
              <ul className="list-disc space-y-1 pl-4">
                <li>AI returns responses for each user turn.</li>
                <li>Escalation is detected or skipped based on risk outcome.</li>
                <li>If escalated, case id and assignment are returned.</li>
                <li>Counselor visibility check confirms case appears in counselor page flow.</li>
                <li>Autopilot actions for the same session are listed.</li>
              </ul>
              <button onClick={onListUsers} disabled={disabledAction} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm text-white disabled:opacity-50"><FiUsers /> Validate User Pool</button>
            </div>
          </div>
        )}

        {activeTab === "research" && (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <button onClick={onRunRQ1} disabled={disabledAction} className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300 disabled:opacity-50"><FiBookOpen /> RQ1 Batch</button>
            <button onClick={onRunRQ2} disabled={disabledAction} className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-400/30 bg-blue-400/10 px-3 py-2 text-sm text-blue-300 disabled:opacity-50"><FiLayers /> RQ2 Orchestration</button>
            <button onClick={onRunRQ3Generate} disabled={disabledAction} className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-400/30 bg-purple-400/10 px-3 py-2 text-sm text-purple-300 disabled:opacity-50"><FiActivity /> RQ3 Generate</button>
            <button onClick={onRunRQ3Privacy} disabled={disabledAction} className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-300 disabled:opacity-50"><FiAlertTriangle /> RQ3 Privacy</button>
          </div>
        )}

        {activeTab === "autopilot" && (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 lg:col-span-2">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/70">Autopilot Replay Scenario</h2>
              <p className="mb-3 text-xs text-white/60">Executes `scripts/replay_autopilot_demo.py` via backend and returns artifact/log tail for judge-ready demo proof with scenario metadata.</p>

              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="text-xs text-white/60 sm:col-span-2">
                  Scenario Preset
                  <select
                    value={autopilotScenario}
                    onChange={(event) => applyScenarioPreset(event.target.value as AutopilotScenario)}
                    className="mt-1 w-full rounded-md border border-white/20 bg-[#001D58] px-2 py-2 text-sm text-white"
                  >
                    {Object.entries(SCENARIO_PRESETS).map(([key, item]) => (
                      <option key={key} value={key}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <p className="sm:col-span-2 rounded-md border border-white/10 bg-black/20 p-2 text-xs text-white/70">
                  {SCENARIO_PRESETS[autopilotScenario].description}
                </p>
                <label className="text-xs text-white/60">
                  Action A Type
                  <select value={actionAType} onChange={(event) => setActionAType(event.target.value as AutopilotActionType)} className="mt-1 w-full rounded-md border border-white/20 bg-[#001D58] px-2 py-1.5 text-sm text-white">
                    <option value="publish_attestation">publish_attestation</option>
                    <option value="mint_badge">mint_badge</option>
                    <option value="create_checkin">create_checkin</option>
                    <option value="create_case">create_case</option>
                  </select>
                </label>
                <label className="text-xs text-white/60">
                  Action A Risk
                  <select value={actionARisk} onChange={(event) => setActionARisk(event.target.value as AutopilotRisk)} className="mt-1 w-full rounded-md border border-white/20 bg-[#001D58] px-2 py-1.5 text-sm text-white">
                    <option value="none">none</option>
                    <option value="low">low</option>
                    <option value="moderate">moderate</option>
                    <option value="high">high</option>
                    <option value="critical">critical</option>
                  </select>
                </label>
                <label className="text-xs text-white/60">
                  Action B Type
                  <select value={actionBType} onChange={(event) => setActionBType(event.target.value as AutopilotActionType)} className="mt-1 w-full rounded-md border border-white/20 bg-[#001D58] px-2 py-1.5 text-sm text-white">
                    <option value="publish_attestation">publish_attestation</option>
                    <option value="mint_badge">mint_badge</option>
                    <option value="create_checkin">create_checkin</option>
                    <option value="create_case">create_case</option>
                  </select>
                </label>
                <label className="text-xs text-white/60">
                  Action B Risk
                  <select value={actionBRisk} onChange={(event) => setActionBRisk(event.target.value as AutopilotRisk)} className="mt-1 w-full rounded-md border border-white/20 bg-[#001D58] px-2 py-1.5 text-sm text-white">
                    <option value="none">none</option>
                    <option value="low">low</option>
                    <option value="moderate">moderate</option>
                    <option value="high">high</option>
                    <option value="critical">critical</option>
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-white/60">
                  Process timeout (seconds)
                  <input
                    type="number"
                    min={30}
                    max={900}
                    value={replayTimeoutSeconds}
                    onChange={(event) => setReplayTimeoutSeconds(Number(event.target.value) || 240)}
                    className="mt-1 rounded-md border border-white/20 bg-[#001D58] px-2 py-1.5 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-white/60">
                  Wait timeout (seconds)
                  <input
                    type="number"
                    min={10}
                    max={600}
                    value={replayWaitTimeoutSeconds}
                    onChange={(event) => setReplayWaitTimeoutSeconds(Number(event.target.value) || 90)}
                    className="mt-1 rounded-md border border-white/20 bg-[#001D58] px-2 py-1.5 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-white/60">
                  Poll interval (seconds)
                  <input
                    type="number"
                    min={0.2}
                    max={10}
                    step={0.2}
                    value={replayWaitIntervalSeconds}
                    onChange={(event) => setReplayWaitIntervalSeconds(Number(event.target.value) || 2)}
                    className="mt-1 rounded-md border border-white/20 bg-[#001D58] px-2 py-1.5 text-sm text-white"
                  />
                </label>
                <label className="mb-0.5 inline-flex items-center gap-2 rounded-md border border-white/20 bg-[#001D58]/60 px-2 py-2 text-xs text-white/80">
                  <input
                    type="checkbox"
                    checked={autoApproveReplay}
                    onChange={(event) => setAutoApproveReplay(event.target.checked)}
                  />
                  Auto-approve gated actions
                </label>
                <button onClick={onRunAutopilotReplay} disabled={disabledAction} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#FFCA40]/30 bg-[#FFCA40]/15 px-3 py-2 text-sm text-[#FFCA40] disabled:opacity-50"><FiZap /> Run Autopilot Replay</button>
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/70">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/70">Expected Validation</h2>
              <ul className="list-disc space-y-1 pl-4">
                <li>Two actions are enqueued based on selected scenario and action parameters.</li>
                <li>Policy decisions (`allow` / `require_approval`) reflect selected risk levels.</li>
                <li>Tx hashes and explorer links are present once actions are confirmed.</li>
                <li>Artifact includes scenario description and exact parameters used.</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === "logs" && (
          <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/70">Log Controls</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="text-xs text-white/60 sm:col-span-2">
                Filter contains
                <input
                  value={logContains}
                  onChange={(event) => setLogContains(event.target.value)}
                  placeholder="error | autopilot | proof"
                  className="mt-1 w-full rounded-md border border-white/20 bg-[#001D58] px-2 py-1.5 text-sm text-white"
                />
              </label>
              <div className="flex flex-col gap-2">
                <button onClick={() => refreshBackendLogs()} disabled={loadingLogs} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm text-white disabled:opacity-50"><FiRefreshCw className={loadingLogs ? "animate-spin" : ""} /> Refresh Logs</button>
                <button onClick={() => setAutoRefreshLogs((prev) => !prev)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm text-white"><FiActivity /> Auto Refresh: {autoRefreshLogs ? "ON" : "OFF"}</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {latestFullFlowResult && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/70">Latest Full Flow Result</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-white/50">Escalated</p>
              <p className={`mt-1 text-sm font-semibold ${latestFullFlowResult.escalation_triggered ? "text-amber-300" : "text-emerald-300"}`}>
                {latestFullFlowResult.escalation_triggered ? "YES" : "NO"}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-white/50">Case ID</p>
              <p className="mt-1 text-sm font-semibold text-white break-all">{latestFullFlowResult.case_id ?? "-"}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-white/50">Assigned Counselor</p>
              <p className="mt-1 text-sm font-semibold text-white">{latestFullFlowResult.assigned_counselor_name ?? "Unassigned"}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-white/50">Counselor Visibility</p>
              <p className={`mt-1 text-sm font-semibold ${latestFullFlowResult.counselor_can_see_case ? "text-emerald-300" : "text-red-300"}`}>
                {latestFullFlowResult.counselor_can_see_case ? "VISIBLE" : "NOT VISIBLE"}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-white/50">Autopilot Actions</p>
              <p className="mt-1 text-sm font-semibold text-white">{latestFullFlowResult.autopilot_actions.length}</p>
            </div>
          </div>
          {latestFullFlowResult.notes.length > 0 && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-white/50">Notes</p>
              <ul className="mt-1 list-disc pl-4 text-xs text-white/80 space-y-1">
                {latestFullFlowResult.notes.map((note, index) => (
                  <li key={`${index}-${note.slice(0, 16)}`}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/50 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/70">Terminal Output</h2>
          <div className="max-h-105 overflow-auto rounded-lg border border-white/10 bg-black/60 p-3 font-mono text-xs text-green-300">
            {terminalEntries.length === 0 ? (
              <p className="text-white/40">No command output yet.</p>
            ) : (
              terminalEntries.map((entry) => (
                <div key={entry.id} className="mb-1 whitespace-pre-wrap wrap-break-word">
                  <span className="text-white/40">[{entry.time}]</span>{" "}
                  <span
                    className={
                      entry.level === "error"
                        ? "text-red-300"
                        : entry.level === "success"
                          ? "text-emerald-300"
                          : "text-cyan-300"
                    }
                  >
                    {entry.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/50 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/70">Backend Log Tail</h2>
          <div className="max-h-105 overflow-auto rounded-lg border border-white/10 bg-black/60 p-3 font-mono text-xs text-white/80">
            {backendLogLines.length === 0 ? (
              <p className="text-white/40">No log lines returned.</p>
            ) : (
              backendLogLines.map((line, index) => (
                <div key={`${index}-${line.slice(0, 16)}`} className="whitespace-pre-wrap wrap-break-word text-white/75">
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
