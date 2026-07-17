'use client';

import { useRouter } from 'next/navigation';
import { ConversationsByUserView } from '@/components/conversations/ConversationsByUserView';

export default function ConversationsPage() {
  const router = useRouter();

  return (
    <ConversationsByUserView
      portal="admin"
      title="AI Conversations"
      subtitle="Start with a user-level view, then drill into session-level details."
      allowFlagging
      onOpenSession={(sessionId) => router.push(`/admin/conversations/session/${sessionId}`)}
    />
  );
}
