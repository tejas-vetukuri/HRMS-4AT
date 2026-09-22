'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth/useAuth';

// Home landing. Only surfaces modules with a real working backend; the
// previous dashboard widgets (timesheet, payslips, announcements, etc.) were
// shells for modules not yet built on the core.
const cards = [
  { href: '/employees', title: 'Employees', desc: 'The employee directory — scoped to what your role can see.' },
  { href: '/org', title: 'Organisation', desc: 'Browse the directory and organisation chart.' },
  { href: '/manage-org', title: 'Manage organisation', desc: 'Employees, reporting lines and org structure.' },
  { href: '/admin', title: 'Access control', desc: 'Roles, permissions and the activity log.' },
  { href: '/team', title: 'My Team', desc: 'Your direct reports and their records.' },
  { href: '/profile', title: 'My Profile', desc: 'Your personal information and records.' },
];

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Welcome, {user?.firstName || 'there'}</h2>
        <p className="text-slate-500 mt-1">Role-aware HR platform — you see exactly what your access allows.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="block rounded-2xl border border-slate-200 bg-white p-5 hover:border-indigo-300 hover:shadow-sm transition-all"
          >
            <div className="font-semibold text-slate-900">{c.title}</div>
            <div className="text-sm text-slate-500 mt-1">{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
