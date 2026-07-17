'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiSend } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { apiCall } from '@/utils/api';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface SurveyQuestion {
  id: number;
  question_text: string;
  question_type: string;
  options: string[] | null;
}

interface Survey {
  id: number;
  title: string;
  description: string | null;
  questions: SurveyQuestion[];
}

export default function SurveyPage() {
  const { status } = useSession();
  const router = useRouter();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchActiveSurvey = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiCall<Survey>('/api/v1/surveys/active');
      setSurvey(data);
    } catch (error) {
      console.error('Error fetching active survey:', error);
      // It's okay if there's no active survey, so we don't show an error toast
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchActiveSurvey();
    }
  }, [status, fetchActiveSurvey]);

  const handleAnswerChange = (questionId: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    if (!survey) return;
    try {
      const responseData = {
        answers: Object.entries(answers).map(([question_id, answer_text]) => ({
          question_id: parseInt(question_id, 10),
          answer_text,
        })),
      };
      await apiCall(`/api/v1/surveys/${survey.id}/responses`, {
        method: 'POST',
        body: JSON.stringify(responseData),
      });
      toast.success('Survey submitted successfully');
      router.push('/aika');
    } catch (error) {
      console.error('Error submitting survey:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit survey');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!survey) {
    return <div>No active survey at the moment.</div>;
  }

  return (
    <div className="container mx-auto px-4 pt-24 pb-12">
      <h1 className="text-3xl font-bold text-white mb-4">{survey.title}</h1>
      <p className="text-gray-400 mb-8">{survey.description}</p>

      <div className="space-y-6">
        {survey.questions.map((q) => {
          const inputId = `survey-question-${q.id}`;
          return (
            <div key={q.id}>
            <label htmlFor={inputId} className="block text-lg font-medium text-white mb-2">{q.question_text}</label>
            {q.question_type === 'text' && (
              <textarea
                id={inputId}
                value={answers[q.id] || ''}
                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[#FFCA40] focus:border-[#FFCA40] transition-colors"
              />
            )}
            {q.question_type === 'rating' && (
              <div className="flex space-x-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => handleAnswerChange(q.id, rating.toString())}
                    className={`px-4 py-2 rounded-lg ${
                      answers[q.id] === rating.toString()
                        ? 'bg-[#FFCA40] text-black'
                        : 'bg-white/10 text-white'
                    }`}
                  >
                    {rating}
                  </button>
                ))}
              </div>
            )}
            {q.question_type === 'multiple-choice' && q.options && (
              <div className="space-y-2">
                {q.options.map((option) => (
                  <label key={option} className="flex items-center">
                    <input
                      type="radio"
                      name={`question-${q.id}`}
                      value={option}
                      checked={answers[q.id] === option}
                      onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      className="h-4 w-4 text-[#FFCA40] focus:ring-[#FFCA40] bg-white/10 border-white/20"
                    />
                    <span className="ml-2 text-white">{option}</span>
                  </label>
                ))}
              </div>
            )}
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <button
          onClick={handleSubmit}
          className="inline-flex items-center px-6 py-3 bg-[#FFCA40] hover:bg-[#ffda63] text-black rounded-lg text-lg font-medium transition-colors"
        >
          <FiSend className="h-5 w-5 mr-2" />
          Submit
        </button>
      </div>
    </div>
  );
}
