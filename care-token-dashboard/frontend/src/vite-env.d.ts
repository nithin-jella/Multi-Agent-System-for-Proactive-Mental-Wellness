/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_SOMNIA_RPC_URL?: string
  readonly VITE_CARE_TOKEN_ADDRESS?: string
  readonly VITE_PLATFORM_REVENUE_ORACLE_ADDRESS?: string
  readonly VITE_CARE_STAKING_HALAL_ADDRESS?: string
  // Add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
