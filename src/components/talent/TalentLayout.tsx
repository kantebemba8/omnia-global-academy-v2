import type { ReactNode } from 'react';
import { AdaptiveTalentLayout } from './TalentRoleLayout';

export function TalentLayout({ children }: { children: ReactNode }) {
  return <AdaptiveTalentLayout>{children}</AdaptiveTalentLayout>;
}
