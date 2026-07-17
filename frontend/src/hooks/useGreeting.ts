// src/hooks/useGreeting.ts
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import apiClient from '@/services/api';
import type { Message } from '@/types/chat';

const DEFAULT_GREETING = "Halo! Aku Aika, teman AI-mu dari UGM-AICare. Ada yang ingin kamu ceritakan hari ini? 😊";

export function useGreeting(messages: Message[]) {
  const { data: session } = useSession();
  const [initialGreeting, setInitialGreeting] = useState<string>(DEFAULT_GREETING);
  const [isGreetingLoading, setIsGreetingLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchAndPrepareGreeting = async () => {
      if (session?.user?.id && messages.length === 0) {
        setIsGreetingLoading(true);
        try {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Add a 2-second delay
          // Step 1: Fetch the latest detailed summary
          const summaryResponse = await apiClient.get<{ summary_text: string | null; timestamp: string | null }>('/user/latest-summary');
          const detailedSummary = summaryResponse.data?.summary_text;

          if (detailedSummary) {
            try {
              // Step 2: Generate a short greeting hook from the detailed summary
              const hookResponse = await apiClient.post<{ greeting_hook: string | null }>('/user/generate-greeting-hook', {
                detailed_summary_text: detailedSummary,
              });
              const greetingHook = hookResponse.data?.greeting_hook;

              if (greetingHook && greetingHook.trim() !== "") {
                setInitialGreeting(greetingHook);
              } else {
                setInitialGreeting(`Halo! Senang bertemu lagi. Ada yang ingin kamu diskusikan dari sesi terakhir kita, atau ada hal baru yang ingin kamu ceritakan?`);
              }
            } catch (hookError) {
              console.error("Failed to generate greeting hook:", hookError);
              setInitialGreeting(`Halo! Senang bertemu lagi. Bagaimana kabarmu hari ini?`);
            }
          } else {
            setInitialGreeting(DEFAULT_GREETING);
          }
        } catch (summaryError) {
          console.error("Failed to fetch last session summary:", summaryError);
          setInitialGreeting(DEFAULT_GREETING);
        } finally {
          setIsGreetingLoading(false);
        }
      } else if (messages.length > 0 || !session?.user?.id) {
        setIsGreetingLoading(false);
      }
    };

    fetchAndPrepareGreeting();
  }, [session, messages.length]);

  return { initialGreeting, isGreetingLoading };
}
