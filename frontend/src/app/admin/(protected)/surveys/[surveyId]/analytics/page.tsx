'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { apiCall, authenticatedFetch } from '@/utils/adminApi';

interface AnalyticsQuestion {
  question_id: number;
  question_text: string;
  question_type: string;
  counts?: Record<string, number>; // multiple-choice
  histogram?: Record<string, number>; // rating
  average?: number | null; // rating
  responses?: number; // text
}

interface AnalyticsPayload {
  survey_id: number;
  total_responses: number;
  questions: AnalyticsQuestion[];
}

export default function SurveyAnalyticsPage() {
  const params = useParams<{ surveyId: string }>();
  const router = useRouter();
  const surveyId = parseInt(params.surveyId, 10);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiCall<AnalyticsPayload>(`/api/v1/admin/surveys/${surveyId}/analytics`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [surveyId]);

  useEffect(() => {
    if (!Number.isNaN(surveyId)) {
      void fetchAnalytics();
    }
  }, [surveyId, fetchAnalytics]);

  const handleDownloadCsv = async () => {
    const isServer = typeof window === 'undefined';
    const apiUrl = isServer ? (process.env.INTERNAL_API_URL as string) : (process.env.NEXT_PUBLIC_API_URL as string);
    const res = await authenticatedFetch(`${apiUrl}/api/v1/admin/surveys/${surveyId}/responses/export`);
    const text = await res.text();
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `survey_${surveyId}_responses.csv`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Survey Analytics</h1>
        <div className="flex gap-2">
          <Button variant="outline" className="text-white" onClick={() => router.back()}>Back</Button>
          <Button variant="primaryGold" onClick={handleDownloadCsv}>Export CSV</Button>
        </div>
      </div>
      {loading ? (
        <div className="text-gray-300">Loading...</div>
      ) : !data ? (
        <div className="text-gray-300">No analytics available.</div>
      ) : (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="text-white">Total Responses</div>
              <div className="text-2xl font-bold text-white">{data.total_responses}</div>
            </div>
            {data.questions.map((q) => (
              <div key={q.question_id} className="border-t border-white/10 pt-4">
                <div className="text-white font-semibold">{q.question_text}</div>
                <div className="text-xs text-gray-300 mb-2">Type: {q.question_type}</div>
                {q.counts && (
                  <ul className="space-y-1 text-gray-100 text-sm">
                    {Object.entries(q.counts).map(([opt, cnt]) => (
                      <li key={opt} className="flex items-center justify-between"><span>{opt}</span><span className="text-gray-300">{cnt}</span></li>
                    ))}
                  </ul>
                )}
                {q.histogram && (
                  <div className="space-y-1 text-gray-100 text-sm">
                    <div>Average: <span className="font-semibold">{q.average ?? '-'}</span></div>
                    {Object.entries(q.histogram).map(([val, cnt]) => (
                      <div key={val} className="flex items-center justify-between"><span>{val}</span><span className="text-gray-300">{cnt}</span></div>
                    ))}
                  </div>
                )}
                {typeof q.responses === 'number' && (
                  <div className="text-gray-100 text-sm">Responses: {q.responses}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
