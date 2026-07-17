'use client';

import { useRouter } from 'next/navigation';
import { ConversationsByUserView } from '@/components/conversations/ConversationsByUserView';

export default function CounselorConversationsPage() {
  const router = useRouter();

  return (
    <ConversationsByUserView
      portal="counselor"
      title="Patient Conversations"
      subtitle="Review caseload conversations by patient, then open session timelines for context."
      onOpenSession={(sessionId) => router.push(`/counselor/conversations/session/${sessionId}`)}
      allowFlagging={false}
    />
  );
}
