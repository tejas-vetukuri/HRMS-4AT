'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/useAuth';
import { useRequireAccess } from '@/lib/auth/useRequireAccess';
import { RolesTab } from '@/components/admin/RolesTab';
import { PermissionsTab } from '@/components/admin/PermissionsTab';
import { PeopleTab } from '@/components/admin/PeopleTab';
import { ExceptionsTab } from '@/components/admin/ExceptionsTab';
import { ActivityTab } from '@/components/admin/ActivityTab';

type TabId = 'roles' | 'permissions' | 'people' | 'exceptions' | 'activity';

const TABS: { id: TabId; label: string; permission?: string }[] = [
  { id: 'roles', label: 'Roles & permissions' },
  { id: 'permissions', label: 'Permissions by module' },
  { id: 'people', label: 'People' },
  { id: 'exceptions', label: 'Personal exceptions' },
  { id: 'activity', label: 'Activity log', permission: 'audit.read' },
];

function AccessControl() {
  const { hasAccess, isLoading } = useRequireAccess({ permission: 'roles.manage' });
  const { hasPermission } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const visibleTabs = TABS.filter((t) => !t.permission || hasPermission(t.permission));
  const requested = searchParams.get('tab') as TabId | null;
  const tab: TabId = visibleTabs.some((t) => t.id === requested) ? (requested as TabId) : 'roles';

  if (isLoading || !hasAccess) return null;

  return (
    <div className="min-h-screen bg-gray-50 font-['Inter']">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-8">
        <div className="flex gap-5 overflow-x-auto scrollbar-hide" role="tablist">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => router.replace(`/admin?tab=${t.id}`)}
              className={`px-1 py-3 border-b-2 font-semibold whitespace-nowrap transition-colors ${
                tab === t.id ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-8">
        {tab === 'roles' && <RolesTab />}
        {tab === 'permissions' && <PermissionsTab />}
        {tab === 'people' && <PeopleTab />}
        {tab === 'exceptions' && <ExceptionsTab />}
        {tab === 'activity' && <ActivityTab />}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AccessControl />
    </Suspense>
  );
}
