'use client';
import { CopilotArea } from '@/components/app/CopilotArea';
import { useAppContext } from '@/components/app/AppShell';

export default function CopilotPage() {
  const { userId, selection } = useAppContext();
  return (
    <CopilotArea
      key={`${userId}-${selection?.tenantId ?? ''}-${selection?.branchId ?? ''}`}
    />
  );
}
