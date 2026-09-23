'use client';

import { useState, useEffect } from 'react';
import { useRequireAccess } from '@/lib/auth/useRequireAccess';
import EmployeeFinancialInfoTab from './components/EmployeeFinancialInfoTab';
import CompensationTab from './components/CompensationTab';
import StatutoryInfoTab from './components/StatutoryInfoTab';
import DeductionsTab from './components/DeductionsTab';
import BenefitsTab from './components/BenefitsTab';
import OvertimeAdjustmentsTab from './components/OvertimeAdjustmentsTab';
import PayrollStatusTab from './components/PayrollStatusTab';

type TabKey = 'financial' | 'compensation' | 'statutory' | 'deductions' | 'benefits' | 'overtime' | 'status';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  work_email: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  const body = await res.json();
  if (!res.ok || !body?.success) throw new Error(body?.error?.message || 'Request failed');
  return body.data as T;
}

export default function PayrollInputsPage() {
  useRequireAccess({ permission: 'payroll.write', requireOrgScope: true });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('financial');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchJson<Employee[]>('/api/employees/');
        setEmployees(data);
        if (data.length > 0) setSelectedEmployeeId(data[0].id);
      } catch (err) {
        console.error('Failed to load employees');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredEmployees = employees.filter(
    (e) =>
      `${e.first_name} ${e.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.work_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  const tabs: Array<{ id: TabKey; label: string }> = [
    { id: 'financial', label: 'Financial Info' },
    { id: 'compensation', label: 'Compensation' },
    { id: 'statutory', label: 'Statutory Info' },
    { id: 'deductions', label: 'Deductions' },
    { id: 'benefits', label: 'Benefits' },
    { id: 'overtime', label: 'Overtime & Leave' },
    { id: 'status', label: 'Payroll Status' },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Payroll Inputs</h1>
        <p className="text-gray-600 mt-2">Manage employee payroll information and settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Employee Picker */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-6">
            <h2 className="font-semibold text-slate-900 mb-4">Select Employee</h2>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 text-sm"
            />
            {loading ? (
              <div className="text-gray-500 text-sm">Loading employees...</div>
            ) : (
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {filteredEmployees.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => setSelectedEmployeeId(emp.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedEmployeeId === emp.id
                        ? 'bg-blue-100 text-blue-900 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-medium">
                      {emp.first_name} {emp.last_name}
                    </div>
                    <div className="text-xs text-gray-600">{emp.work_email}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {selectedEmployee ? (
            <div className="space-y-4">
              {/* Employee Header */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4">
                <h2 className="text-xl font-bold text-slate-900">
                  {selectedEmployee.first_name} {selectedEmployee.last_name}
                </h2>
                <p className="text-gray-600 text-sm">{selectedEmployee.work_email}</p>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200 overflow-x-auto">
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

              {/* Tab Content */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                {activeTab === 'financial' && <EmployeeFinancialInfoTab employeeId={selectedEmployeeId} />}
                {activeTab === 'compensation' && <CompensationTab employeeId={selectedEmployeeId} />}
                {activeTab === 'statutory' && <StatutoryInfoTab employeeId={selectedEmployeeId} />}
                {activeTab === 'deductions' && <DeductionsTab employeeId={selectedEmployeeId} />}
                {activeTab === 'benefits' && <BenefitsTab employeeId={selectedEmployeeId} />}
                {activeTab === 'overtime' && <OvertimeAdjustmentsTab employeeId={selectedEmployeeId} />}
                {activeTab === 'status' && <PayrollStatusTab />}
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-center py-12">No employees available</div>
          )}
        </div>
      </div>
    </div>
  );
}
