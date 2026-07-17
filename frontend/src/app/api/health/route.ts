/**
 * Health check endpoint for frontend monitoring and deployment verification
 * Returns 200 OK if the Next.js server is running and operational
 * 
 * This endpoint is used by:
 * - Docker health checks
 * - Load balancers
 * - Monitoring systems (Prometheus, etc.)
 * - CI/CD deployment verification
 * 
 * Best Practice: Health endpoints should be:
 * - Fast (< 50ms response time)
 * - Stateless (no database/external calls)
 * - Non-cached (always return fresh status)
 * - Simple (just confirm the server process is alive)
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Disable Next.js caching for health checks
export const runtime = 'nodejs'; // Use Node.js runtime for faster response

export async function GET() {
  // Return 200 OK with basic server info
  // No database checks - just confirm Next.js process is responding
  return NextResponse.json(
    {
      status: 'ok',
      service: 'ugm-aicare-frontend',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      version: process.env.npm_package_version || 'unknown',
    },
    { 
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      }
    }
  );
}

// Optional: Support HEAD requests for lightweight health checks
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
