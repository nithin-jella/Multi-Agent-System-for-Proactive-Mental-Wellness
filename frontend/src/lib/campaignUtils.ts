export type TargetAudience = 'all_users' | 'high_risk' | 'inactive' | 'recent_cases' | 'custom';

/**
 * Type guard to check if value is a TargetAudienceObject
 */
export function isTargetAudienceObject(value: unknown): value is { type: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof (value as Record<string, unknown>)['type'] === 'string'
  );
}

/**
 * Extract the TargetAudience type from various formats
 * 
 * @param audience - Backend target_audience value
 * @returns The TargetAudience string or null if invalid
 */
export function extractTargetAudienceType(audience: unknown): string | null {
  if (audience === undefined || audience === null) return null;
  
  // Direct string
  if (typeof audience === 'string') return audience;
  
  // Object with 'type' field
  if (isTargetAudienceObject(audience)) {
    return audience.type;
  }
  
  return null;
}

/**
 * Safely format target audience for display
 * Handles TargetAudienceObject from backend ({type: string}), legacy strings, and unknown formats
 * 
 * @param audience - Can be {type: TargetAudience}, string, or unknown
 * @returns Human-readable audience label with underscores replaced by spaces
 */
export function formatTargetAudience(audience: unknown): string {
  if (audience === undefined || audience === null) return 'Not specified';

  // Handle direct string (legacy or simple format)
  if (typeof audience === 'string') {
    return audience.replace(/_/g, ' ');
  }

  // Handle object format (standard backend response)
  if (typeof audience === 'object') {
    const obj = audience as Record<string, unknown>;
    
    // Check for standard 'type' field (TargetAudienceObject)
    const maybeType = obj['type'];
    if (typeof maybeType === 'string') {
      return maybeType.replace(/_/g, ' ');
    }
    
    // Fallback: check for 'label' field
    const maybeLabel = obj['label'];
    if (typeof maybeLabel === 'string') return maybeLabel;
    
    // Last resort: stringify the object
    try {
      return JSON.stringify(obj);
    } catch {
      return 'Not specified';
    }
  }

  return String(audience);
}
