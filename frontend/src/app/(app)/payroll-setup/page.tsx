'use client';

import { useState } from 'react';
import { useRequireAccess } from '@/lib/auth/useRequireAccess';
import PayScheduleTab from './components/PayScheduleTab';
import StatutoryTab from './components/StatutoryTab';
import SalaryStructureTab from './components/SalaryStructureTab';
import TaxFilingTab from './components/TaxFilingTab';
import PayStubTab from './components/PayStubTab';
import ApprovalWorkflowTab from './components/ApprovalWorkflowTab';

type TabKey = 'pay-schedules' | 'statutory' | 'salary-structure' | 'tax-filing' | 'pay-stub' | 'approval-workflow';

interface Tab {
  id: TabKey;
  label: string;
  component: React.ReactNode;
}

export default function PayrollSetupPage() {
  // Gate access to Finance role only
  useRequireAccess({ permission: 'payroll.write', requireOrgScope: true });

  const [activeTab, setActiveTab] = useState<TabKey>('pay-schedules');

  const tabs: Tab[] = [
    {
      id: 'pay-schedules',
      label: 'Pay Schedules',
      component: <PayScheduleTab />,
    },
    {
      id: 'statutory',
      label: 'Contributions & Deductions',
      component: <StatutoryTab />,
    },
    {
      id: 'salary-structure',
      label: 'Salary Structure',
      component: <SalaryStructureTab />,
    },
    {
      id: 'tax-filing',
      label: 'Tax Filing',
      component: <TaxFilingTab />,
    },
    {
      id: 'pay-stub',
      label: 'Pay Stub',
      component: <PayStubTab />,
    },
    {
      id: 'approval-workflow',
      label: 'Approval Workflow',
      component: <ApprovalWorkflowTab />,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Payroll Setup</h1>
        <p className="text-gray-600 mt-2">Configure payroll settings and policies</p>
      </div>

      {/* Tab navigation */}
      <div className="mb-6 border-b border-gray-200 overflow-x-auto">
        <nav className="flex gap-2" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        {tabs.find((tab) => tab.id === activeTab)?.component}
      </div>
    </div>
  );
}
