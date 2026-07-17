"""
Prometheus metrics for production monitoring.

This module defines all custom metrics for the UGM-AICare platform,
including mental health-specific metrics for agents, interventions, and user engagement.
"""
import time
from functools import wraps
from typing import Callable, Any
from prometheus_client import Counter, Histogram, Gauge, Info

# ============================================
# HTTP REQUEST METRICS
# ============================================

http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint'],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 7.5, 10.0)
)

# ============================================
# AGENT METRICS
# ============================================

agent_processing_time_seconds = Histogram(
    'agent_processing_time_seconds',
    'Agent processing time in seconds',
    ['agent_name', 'user_role'],
    buckets=(0.1, 0.25, 0.5, 1.0, 2.0, 3.0, 5.0, 10.0, 15.0, 30.0)
)

agent_invocations_total = Counter(
    'agent_invocations_total',
    'Total agent invocations',
    ['agent_name', 'user_role', 'intent']
)

agent_errors_total = Counter(
    'agent_errors_total',
    'Total agent errors',
    ['agent_name', 'error_type']
)

agent_success_rate = Gauge(
    'agent_success_rate',
    'Agent success rate (0-1)',
    ['agent_name']
)

# ============================================
# LLM API METRICS
# ============================================

llm_api_calls_total = Counter(
    'llm_api_calls_total',
    'Total LLM API calls',
    ['model', 'success']
)

llm_api_duration_seconds = Histogram(
    'llm_api_duration_seconds',
    'LLM API call duration in seconds',
    ['model'],
    buckets=(0.5, 1.0, 2.0, 3.0, 5.0, 10.0, 15.0, 20.0, 30.0, 60.0)
)

llm_token_usage_total = Counter(
    'llm_token_usage_total',
    'Total LLM tokens used',
    ['model', 'type']  # type: prompt_tokens or completion_tokens
)

llm_api_errors_total = Counter(
    'llm_api_errors_total',
    'Total LLM API errors',
    ['model', 'error_type']
)

# ============================================
# TOOL EXECUTION METRICS
# ============================================

tool_execution_time_seconds = Histogram(
    'tool_execution_time_seconds',
    'Tool execution time in seconds',
    ['tool_name', 'success'],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0)
)

tool_calls_total = Counter(
    'tool_calls_total',
    'Total tool calls',
    ['tool_name', 'success']
)

# ============================================
# INTERVENTION PLAN METRICS
# ============================================

intervention_plans_created_total = Counter(
    'intervention_plans_created_total',
    'Total intervention plans created',
    ['plan_type', 'risk_level']
)

intervention_plan_steps_completed_total = Counter(
    'intervention_plan_steps_completed_total',
    'Total intervention plan steps completed',
    ['plan_type', 'step_number']
)

intervention_plan_completion_rate = Gauge(
    'intervention_plan_completion_rate',
    'Intervention plan completion rate (0-1)',
    ['plan_type']
)

intervention_plan_abandonment_rate = Gauge(
    'intervention_plan_abandonment_rate',
    'Rate of abandoned intervention plans (0-1)',
    ['plan_type']
)

intervention_plan_average_duration_days = Gauge(
    'intervention_plan_average_duration_days',
    'Average days to complete intervention plans',
    ['plan_type']
)

# ============================================
# CRISIS METRICS
# ============================================

crisis_escalations_total = Counter(
    'crisis_escalations_total',
    'Total crisis escalations',
    ['risk_level', 'escalation_type']
)

crisis_response_time_seconds = Histogram(
    'crisis_response_time_seconds',
    'Crisis response time in seconds',
    ['risk_level'],
    buckets=(30, 60, 120, 300, 600, 900, 1800, 3600)  # 30s to 1hr
)

crisis_false_positive_total = Counter(
    'crisis_false_positive_total',
    'Total false positive crisis detections'
)

crisis_false_negative_total = Counter(
    'crisis_false_negative_total',
    'Total false negative crisis detections'
)

safety_triage_accuracy = Gauge(
    'safety_triage_accuracy',
    'Safety triage accuracy (0-1)',
    ['risk_level']
)

# ============================================
# USER ENGAGEMENT METRICS
# ============================================

active_users_gauge = Gauge(
    'active_users',
    'Currently active users'
)

daily_active_users_gauge = Gauge(
    'daily_active_users',
    'Daily active users'
)

weekly_active_users_gauge = Gauge(
    'weekly_active_users',
    'Weekly active users'
)

user_sessions_total = Counter(
    'user_sessions_total',
    'Total user sessions',
    ['user_role']
)

user_session_duration_seconds = Histogram(
    'user_session_duration_seconds',
    'User session duration in seconds',
    ['user_role'],
    buckets=(60, 300, 600, 1200, 1800, 3600, 7200)  # 1min to 2hrs
)

user_retention_rate = Gauge(
    'user_retention_rate',
    'User retention rate (0-1)',
    ['period']  # '7d', '30d', '90d'
)

user_messages_sent_total = Counter(
    'user_messages_sent_total',
    'Total messages sent by users',
    ['user_role']
)

# ============================================
# COUNSELOR METRICS
# ============================================

counselor_response_time_seconds = Histogram(
    'counselor_response_time_seconds',
    'Counselor response time in seconds',
    ['counselor_id'],
    buckets=(60, 300, 600, 1800, 3600, 7200, 14400)  # 1min to 4hrs
)

counselor_case_load = Gauge(
    'counselor_case_load',
    'Number of active cases per counselor',
    ['counselor_id']
)

counselor_satisfaction_score = Gauge(
    'counselor_satisfaction_score',
    'User satisfaction score with counselor (1-5)',
    ['counselor_id']
)

counselor_availability_hours = Gauge(
    'counselor_availability_hours',
    'Total availability hours per counselor',
    ['counselor_id']
)

# ============================================
# DATABASE METRICS
# ============================================

db_query_duration_seconds = Histogram(
    'db_query_duration_seconds',
    'Database query duration in seconds',
    ['operation', 'table'],
    buckets=(0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0)
)

db_connection_pool_size = Gauge(
    'db_connection_pool_size',
    'Database connection pool size',
    ['pool_name', 'state']  # state: 'active', 'idle', 'total'
)

db_query_errors_total = Counter(
    'db_query_errors_total',
    'Total database query errors',
    ['operation', 'error_type']
)

# ============================================
# CACHE METRICS
# ============================================

cache_hits_total = Counter(
    'cache_hits_total',
    'Total cache hits',
    ['cache_type']  # 'redis', 'memory'
)

cache_misses_total = Counter(
    'cache_misses_total',
    'Total cache misses',
    ['cache_type']
)

cache_hit_rate = Gauge(
    'cache_hit_rate',
    'Cache hit rate (0-1)',
    ['cache_type']
)

# ============================================
# MOOD TRACKING METRICS
# ============================================

mood_scores_recorded_total = Counter(
    'mood_scores_recorded_total',
    'Total mood scores recorded',
    ['mood_category']  # 'positive', 'neutral', 'negative'
)

mood_improvement_score = Gauge(
    'mood_improvement_score',
    'Average mood improvement score (-10 to +10)',
    ['intervention_type']
)

# ============================================
# JOURNAL METRICS
# ============================================

journal_entries_created_total = Counter(
    'journal_entries_created_total',
    'Total journal entries created',
    ['entry_type']  # 'daily', 'prompted', 'freeform'
)

journal_entries_per_user = Gauge(
    'journal_entries_per_user',
    'Average journal entries per user'
)

# ============================================
# APPOINTMENT METRICS
# ============================================

appointments_scheduled_total = Counter(
    'appointments_scheduled_total',
    'Total appointments scheduled',
    ['appointment_type']
)

appointments_completed_total = Counter(
    'appointments_completed_total',
    'Total appointments completed',
    ['appointment_type']
)

appointments_cancelled_total = Counter(
    'appointments_cancelled_total',
    'Total appointments cancelled',
    ['cancellation_reason']
)

appointment_no_show_rate = Gauge(
    'appointment_no_show_rate',
    'Appointment no-show rate (0-1)'
)

# ============================================
# SYSTEM INFO
# ============================================

system_info = Info('system_info', 'System information')
system_info.info({
    'application': 'UGM-AICare',
    'version': '1.0.0',
    'environment': 'production'
})


# ============================================
# METRIC DECORATORS
# ============================================

def track_agent_metrics(agent_name: str):
    """
    Decorator to track agent processing metrics.
    
    Usage:
        @track_agent_metrics("STA")
        async def assess_message(...):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            success = True
            error_type = None
            
            try:
                result = await func(*args, **kwargs)
                
                # Extract metadata from result
                user_role = kwargs.get('user_role', 'unknown')
                intent = result.get('intent', 'unknown') if isinstance(result, dict) else 'unknown'
                
                # Increment invocation counter
                agent_invocations_total.labels(
                    agent_name=agent_name,
                    user_role=user_role,
                    intent=intent
                ).inc()
                
                return result
                
            except Exception as e:
                success = False
                error_type = type(e).__name__
                agent_errors_total.labels(
                    agent_name=agent_name,
                    error_type=error_type
                ).inc()
                raise
                
            finally:
                # Record processing time
                duration = time.time() - start_time
                agent_processing_time_seconds.labels(
                    agent_name=agent_name,
                    user_role=kwargs.get('user_role', 'unknown')
                ).observe(duration)
        
        return wrapper
    return decorator


def track_tool_metrics(tool_name: str):
    """
    Decorator to track tool execution metrics.
    
    Usage:
        @track_tool_metrics("get_user_profile")
        async def get_user_profile(...):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            success = True
            
            try:
                result = await func(*args, **kwargs)
                if isinstance(result, dict) and not result.get('success', True):
                    success = False
                return result
                
            except Exception:
                success = False
                raise
                
            finally:
                duration = time.time() - start_time
                tool_execution_time_seconds.labels(
                    tool_name=tool_name,
                    success=str(success)
                ).observe(duration)
                
                tool_calls_total.labels(
                    tool_name=tool_name,
                    success=str(success)
                ).inc()
        
        return wrapper
    return decorator


def track_db_metrics(operation: str, table: str):
    """
    Decorator to track database query metrics.
    
    Usage:
        @track_db_metrics("select", "users")
        async def get_user(...):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            
            try:
                result = await func(*args, **kwargs)
                return result
                
            except Exception as e:
                error_type = type(e).__name__
                db_query_errors_total.labels(
                    operation=operation,
                    error_type=error_type
                ).inc()
                raise
                
            finally:
                duration = time.time() - start_time
                db_query_duration_seconds.labels(
                    operation=operation,
                    table=table
                ).observe(duration)
        
        return wrapper
    return decorator


def track_llm_metrics(model: str):
    """
    Decorator to track LLM API call metrics.
    
    Usage:
        @track_llm_metrics("gemini-2.0-flash")
        async def call_gemini(...):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            success = True
            
            try:
                result = await func(*args, **kwargs)
                
                # Track token usage if available in result
                if isinstance(result, dict):
                    if 'prompt_tokens' in result:
                        llm_token_usage_total.labels(
                            model=model,
                            type='prompt_tokens'
                        ).inc(result['prompt_tokens'])
                    
                    if 'completion_tokens' in result:
                        llm_token_usage_total.labels(
                            model=model,
                            type='completion_tokens'
                        ).inc(result['completion_tokens'])
                
                return result
                
            except Exception as e:
                success = False
                error_type = type(e).__name__
                llm_api_errors_total.labels(
                    model=model,
                    error_type=error_type
                ).inc()
                raise
                
            finally:
                duration = time.time() - start_time
                llm_api_duration_seconds.labels(model=model).observe(duration)
                llm_api_calls_total.labels(
                    model=model,
                    success=str(success)
                ).inc()
        
        return wrapper
    return decorator
