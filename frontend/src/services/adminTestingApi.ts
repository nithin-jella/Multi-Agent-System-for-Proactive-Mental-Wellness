import { apiCall } from '@/utils/adminApi';

export interface SeedDatabaseRequest {
  users_count: number;
  counselors_count: number;
  admins_count: number;
}

export interface SeedDatabaseResponse {
  users_created: number;
  counselors_created: number;
  admins_created: number;
  details: string[];
}

export interface SeedScreeningProfilesRequest {
  profiles_count: number;
  include_critical: boolean;
  requires_attention_ratio: number;
}

export interface SeedScreeningProfilesResponse {
  requested_profiles: number;
  processed_profiles: number;
  created_profiles: number;
  updated_profiles: number;
  risk_distribution: Record<string, number>;
  details: string[];
}

export interface ListTestUsersResponse {
  users: Array<Record<string, unknown>>;
  total: number;
}

export interface BatchTestRequest {
  rq1_eval_file?: string;
  scenarios?: Array<Record<string, string>>;
}

export interface BatchTestResponse {
  total_tests: number;
  passed: number;
  failed: number;
  results: Array<Record<string, unknown>>;
  metrics?: Record<string, unknown> | null;
}

export interface DeleteTestDataRequest {
  user_ids?: number[];
  delete_all_test_users: boolean;
  delete_conversations: boolean;
}

export interface DeleteTestDataResponse {
  users_deleted: number;
  conversations_deleted: number;
  messages_deleted: number;
}

export interface CreateTestUserRequest {
  email?: string;
  name: string;
  role: 'user' | 'counselor' | 'admin';
  university?: string;
  major?: string;
  year_of_study?: string;
  gender?: string;
  city?: string;
}

export interface CreateTestUserResponse {
  user_id: number;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

export interface SimulateConversationRequest {
  user_id: number;
  messages: string[];
  risk_level?: 'low' | 'med' | 'high' | 'critical';
  auto_classify?: boolean;
  simulate_real_chat?: boolean;
}

export interface SimulateConversationResponse {
  conversation_id: string;
  session_id: string;
  user_id: number;
  messages_created: number;
  conversations_created: number;
  classification?: Record<string, unknown> | null;
  case_created?: boolean | null;
}

export interface SimulateRealChatRequest {
  user_id: number;
  user_messages: string[];
  enable_sta?: boolean;
  enable_sca?: boolean;
}

export interface SimulateRealChatResponse {
  session_id: string;
  user_id: number;
  conversation_turns: number;
  ai_responses: string[];
  risk_assessment?: Record<string, unknown> | null;
  intervention_generated: boolean;
  case_created: boolean;
  final_history: Array<Record<string, unknown>>;
  agent_routing_log?: string[] | null;
}

export interface FullUserFlowSimulationRequest {
  user_id: number;
  user_messages: string[];
  enable_sta?: boolean;
  enable_sca?: boolean;
}

export interface FullUserFlowSimulationResponse {
  user_id: number;
  session_id: string;
  ai_responses: string[];
  escalation_triggered: boolean;
  case_id?: string | null;
  case_status?: string | null;
  case_severity?: string | null;
  assigned_psychologist_id?: number | null;
  assigned_counselor_user_id?: number | null;
  assigned_counselor_name?: string | null;
  counselor_can_see_case: boolean;
  counselor_case_page: string;
  autopilot_actions: Array<Record<string, unknown>>;
  notes: string[];
}

export interface RQ2ValidationResponse {
  total: number;
  passed: number;
  results: Array<Record<string, unknown>>;
}

export interface RQ3GenerateResponse {
  responses: Array<Record<string, unknown>>;
}

export interface RQ3PrivacyResponse {
  k_threshold: number;
  high_severity_count: number;
  critical_severity_count: number;
  high_severity_visible: boolean;
  critical_severity_suppressed: boolean;
  passed: boolean;
  details: string[];
}

export interface AutopilotReplayResponse {
  scenario: string;
  parameters: Record<string, unknown>;
  command: string;
  exit_code: number;
  stdout_tail: string[];
  stderr_tail: string[];
  artifact_path: string;
  artifact?: Record<string, unknown> | null;
}

export interface AutopilotReplayRequest {
  scenario?: 'attestation_pipeline' | 'case_management' | 'mixed_operations';
  action_a_type?: 'publish_attestation' | 'mint_badge' | 'create_checkin' | 'create_case';
  action_a_risk?: 'none' | 'low' | 'moderate' | 'high' | 'critical';
  action_b_type?: 'publish_attestation' | 'mint_badge' | 'create_checkin' | 'create_case';
  action_b_risk?: 'none' | 'low' | 'moderate' | 'high' | 'critical';
  auto_approve?: boolean;
  wait_timeout_seconds?: number;
  wait_interval_seconds?: number;
}

export interface LogTailResponse {
  log_file: string;
  returned_lines: number;
  total_lines: number;
  lines: string[];
}

export async function seedTestingDatabase(payload: SeedDatabaseRequest): Promise<SeedDatabaseResponse> {
  return apiCall<SeedDatabaseResponse>('/api/v1/admin/testing/seed', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function seedScreeningProfiles(payload: SeedScreeningProfilesRequest): Promise<SeedScreeningProfilesResponse> {
  return apiCall<SeedScreeningProfilesResponse>('/api/v1/admin/testing/seed-screening', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listTestingUsers(): Promise<ListTestUsersResponse> {
  return apiCall<ListTestUsersResponse>('/api/v1/admin/testing/users');
}

export async function runRQ1BatchTest(): Promise<BatchTestResponse> {
  const payload: BatchTestRequest = {
    rq1_eval_file: 'rq1',
  };

  return apiCall<BatchTestResponse>('/api/v1/admin/testing/batch-test', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function cleanupTestingData(payload: DeleteTestDataRequest): Promise<DeleteTestDataResponse> {
  return apiCall<DeleteTestDataResponse>('/api/v1/admin/testing/cleanup', {
    method: 'DELETE',
    body: JSON.stringify(payload),
  });
}

export async function getTestingLogTail(params?: { lines?: number; contains?: string }): Promise<LogTailResponse> {
  const query = new URLSearchParams();
  if (params?.lines != null) query.set('lines', String(params.lines));
  if (params?.contains && params.contains.trim()) query.set('contains', params.contains.trim());

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiCall<LogTailResponse>(`/api/v1/admin/testing/logs${suffix}`);
}

export async function createTestingUser(payload: CreateTestUserRequest): Promise<CreateTestUserResponse> {
  return apiCall<CreateTestUserResponse>('/api/v1/admin/testing/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function simulateConversation(payload: SimulateConversationRequest): Promise<SimulateConversationResponse> {
  return apiCall<SimulateConversationResponse>('/api/v1/admin/testing/conversations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function simulateRealChat(payload: SimulateRealChatRequest): Promise<SimulateRealChatResponse> {
  return apiCall<SimulateRealChatResponse>('/api/v1/admin/testing/chat-simulation', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function simulateFullUserFlow(payload: FullUserFlowSimulationRequest): Promise<FullUserFlowSimulationResponse> {
  return apiCall<FullUserFlowSimulationResponse>('/api/v1/admin/testing/full-user-flow', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function runRQ2Validation(): Promise<RQ2ValidationResponse> {
  return apiCall<RQ2ValidationResponse>('/api/v1/admin/testing/rq2/validation', {
    method: 'POST',
  });
}

export async function runRQ3Generate(): Promise<RQ3GenerateResponse> {
  return apiCall<RQ3GenerateResponse>('/api/v1/admin/testing/rq3/generate', {
    method: 'POST',
  });
}

export async function runRQ3PrivacyTest(): Promise<RQ3PrivacyResponse> {
  return apiCall<RQ3PrivacyResponse>('/api/v1/admin/testing/rq3/privacy-test', {
    method: 'POST',
  });
}

export async function runAutopilotReplay(timeoutSeconds = 240, payload?: AutopilotReplayRequest): Promise<AutopilotReplayResponse> {
  return apiCall<AutopilotReplayResponse>(`/api/v1/admin/testing/autopilot-replay?timeout_seconds=${timeoutSeconds}`, {
    method: 'POST',
    body: JSON.stringify(payload ?? {}),
  });
}
