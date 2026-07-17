const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001/api/v1'

export const config = {
  apiBaseUrl: API_BASE_URL,
  somniaRpcUrl: import.meta.env.VITE_SOMNIA_RPC_URL || 'https://rpc.somnia.network',
  careTokenAddress: import.meta.env.VITE_CARE_TOKEN_ADDRESS || '',
  platformRevenueOracleAddress: import.meta.env.VITE_PLATFORM_REVENUE_ORACLE_ADDRESS || '',
  careStakingHalalAddress: import.meta.env.VITE_CARE_STAKING_HALAL_ADDRESS || '',
}
