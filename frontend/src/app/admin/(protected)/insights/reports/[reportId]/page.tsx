/**
 * IA Insights Report Detail Page
 * Displays detailed information about a specific insights report
 */

import { ReportDetailClient } from './ReportDetailClient';

export default function ReportDetailPage({
  params,
}: {
  params: { reportId: string };
}) {
  return <ReportDetailClient reportId={params.reportId} />;
}
