'use client';

import { useState, useEffect } from 'react';

interface Compensation {
  id: string;
  employee: string;
  salary_structure: string;
  fixed_monthly_amount: number | string;
  is_contractor: boolean;
  contractor_rate_type: string;
  contractor_rate: number;
  effective_from: string;
}

interface SalaryStructure {
  id: string;
  name: string;
}

interface PayGroup {
  id: string;
  name: string;
  pay_schedule: string;
}

interface SalaryComponent {
  id: string;
  name: string;
  component_type: 'earning' | 'deduction';
  calculation_type: string;
  default_value: number;
  is_taxable: boolean;
}

interface SalaryStructureComponent {
  component: SalaryComponent;
  value_override: number | null;
}

interface StructureDetails {
  id: string;
  name: string;
  components: SalaryStructureComponent[];
}

interface Props {
  employeeId: string | null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  const body = await res.json();
  if (!res.ok || !body?.success) throw new Error(body?.error?.message || 'Request failed');
  return body.data as T;
}

interface PayrollPreview {
  structure_name: string;
  earnings: Record<string, number>;
  deductions: Record<string, number>;
  totals: Record<string, number>;
}

export default function CompensationTab({ employeeId }: Props) {
  const [compensation, setCompensation] = useState<Compensation | null>(null);
  const [payGroups, setPayGroups] = useState<PayGroup[]>([]);
  const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[]>([]);
  const [selectedStructure, setSelectedStructure] = useState<StructureDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<Compensation>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PayrollPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadCompensation = async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      const data = await fetchJson<Compensation[]>(`/api/payroll-inputs/compensation/?employee_id=${employeeId}`);
      setCompensation(data[0] || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('Loading payroll setup data...');
        const [groupsData, structuresData] = await Promise.all([
          fetchJson<PayGroup[]>('/api/payroll-setup/pay-groups/'),
          fetchJson<SalaryStructure[]>('/api/payroll-setup/salary-structures/'),
        ]);
        console.log('Pay groups raw:', groupsData, 'Type:', typeof groupsData, 'Is array:', Array.isArray(groupsData));
        console.log('Salary structures raw:', structuresData, 'Type:', typeof structuresData, 'Is array:', Array.isArray(structuresData));

        // API returns paginated format: {results: [...], total: N}
        const payGroupsArray = (groupsData as any)?.results || [];
        const structuresArray = (structuresData as any)?.results || [];

        console.log('After processing - pay groups:', payGroupsArray.length, 'structures:', structuresArray.length);
        setPayGroups(payGroupsArray);
        setSalaryStructures(structuresArray);
      } catch (err) {
        console.error('Failed to load setup data:', err);
        setError(`Failed to load salary structures: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    loadCompensation();
  }, [employeeId]);

  // Load structure details when compensation is loaded
  useEffect(() => {
    if (compensation?.salary_structure) {
      loadStructureDetails(compensation.salary_structure);
    }
  }, [compensation]);

  const loadPayrollPreview = async () => {
    if (!employeeId || !formData.fixed_monthly_amount) {
      setError('Please enter annual CTC');
      return;
    }
    try {
      setPreviewLoading(true);
      const ctcAnnual = parseFloat(formData.fixed_monthly_amount as any);  // Now it's annual
      const res = await fetch(`/api/payroll-preview/?employee_id=${employeeId}&ctc=${ctcAnnual}`, {
        credentials: 'include',
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(body?.error?.message || 'Preview failed');
      }
      setPreviewData(body.data);
      setShowPreview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const loadStructureDetails = async (structureId: string) => {
    if (!structureId) return;
    try {
      const data = await fetchJson<StructureDetails>(`/api/payroll-setup/salary-structures/${structureId}/`);
      setSelectedStructure(data);
    } catch (err) {
      console.error('Failed to load structure details:', err);
    }
  };

  useEffect(() => {
    if (formData.salary_structure) {
      loadStructureDetails(formData.salary_structure);
    }
  }, [formData.salary_structure]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !formData.fixed_monthly_amount) return;

    try {
      const annualCtc = parseFloat(formData.fixed_monthly_amount as any);
      const monthlyCtc = annualCtc / 12;

      // Auto-detect salary structure based on CTC range
      const structure = salaryStructures.find(s => {
        // Get min/max from structure name (e.g., "3L-5L" -> 300000-500000)
        if (s.name.includes('Stipend')) return annualCtc >= 150000 && annualCtc <= 240000;
        if (s.name.includes('3L-5L')) return annualCtc >= 300000 && annualCtc <= 500000;
        if (s.name.includes('6L-9L')) return annualCtc >= 600000 && annualCtc <= 900000;
        if (s.name.includes('10L-13L')) return annualCtc >= 1000000 && annualCtc <= 1300000;
        if (s.name.includes('14L-17L')) return annualCtc >= 1400000 && annualCtc <= 1700000;
        if (s.name.includes('25L')) return annualCtc >= 2500000;
        return false;
      });

      if (!structure) {
        setError(`CTC ₹${annualCtc.toLocaleString('en-IN')} doesn't match any salary structure. Valid ranges: Stipend (15K-20K), 3L-5L, 6L-9L, 10L-13L, 14L-17L, 25L+`);
        return;
      }

      const method = compensation ? 'PUT' : 'POST';
      const url = compensation
        ? `/api/payroll-inputs/compensation/${compensation.id}/`
        : '/api/payroll-inputs/compensation/';

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee: employeeId,
          salary_structure: structure.id,
          fixed_monthly_amount: monthlyCtc,
          effective_from: formData.effective_from || new Date().toISOString().split('T')[0],
        }),
      });

      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(body?.error?.message || 'Failed to save');
      }

      setCompensation(body.data);
      setFormData({});
      setEditMode(false);
      setError(null);
      await loadCompensation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save compensation');
    }
  };

  if (!employeeId) return <div className="text-gray-500">Select an employee</div>;
  if (loading) return <div className="text-gray-500">Loading...</div>;

  // Calculate component value based on type and formula
  const calculateComponentValue = (component: SalaryStructureComponent, ctc: number, basicAmount?: number): number => {
    if (component.value_override) return parseFloat(component.value_override as any) || 0;

    const calc = component.component.calculation_type;
    const defaultVal = parseFloat(component.component.default_value as any) || 0;

    if (calc === 'fixed') return defaultVal;

    if (calc === 'formula') {
      const formula = component.component.formula_expr || '';
      let result = formula
        .replace(/ctc/g, ctc.toString())
        .replace(/basic/g, basicAmount?.toString() || '0');
      try {
        return Function('"use strict"; return (' + result + ')')();
      } catch {
        return 0;
      }
    }

    return defaultVal;
  };

  const earnings = selectedStructure?.components?.filter((c) => c.component.component_type === 'earning') || [];
  const deductions = selectedStructure?.components?.filter((c) => c.component.component_type === 'deduction') || [];

  // Calculate basic amount (needed for formula evaluation)
  const monthlyCtc = parseFloat(compensation?.fixed_monthly_amount as any) || 0;
  const basicComponent = earnings.find((e) => e.component.name === 'Basic');
  const basicAmount = basicComponent ? calculateComponentValue(basicComponent, monthlyCtc) : 0;

  // Calculate earnings and deductions
  const earningsData = earnings.map((e) => ({
    component: e,
    value: calculateComponentValue(e, monthlyCtc, basicAmount),
  }));
  const deductionsData = deductions.map((d) => ({
    component: d,
    value: calculateComponentValue(d, monthlyCtc, basicAmount),
  }));

  const totalEarnings = earningsData.reduce((sum, e) => sum + e.value, 0);
  const totalDeductions = deductionsData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="space-y-4">
      {error && <div className="text-red-600 p-3 bg-red-50 rounded-lg">{error}</div>}

      {!editMode && compensation && (
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
            {/* CTC Header */}
            <div className="pb-4 border-b">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Salary Breakdown for INR {(parseFloat(compensation.fixed_monthly_amount as any) * 12).toLocaleString('en-IN', {
                  maximumFractionDigits: 0,
                })}
              </h3>

              {/* Calculation Matrix */}
              <div className="bg-white p-3 rounded border border-gray-300 space-y-1 text-sm">
                <p className="font-medium text-gray-700 mb-2">CTC Breakdown Formula:</p>
                {earningsData.map((e) => {
                  const comp = e.component.component;
                  let formula = '';
                  if (comp.calculation_type === 'formula' && comp.formula_expr) {
                    formula = comp.formula_expr
                      .replace(/ctc/g, `₹${monthlyCtc.toLocaleString('en-IN')}`)
                      .replace(/basic/g, `₹${basicAmount.toLocaleString('en-IN')}`);
                  } else if (comp.calculation_type === 'fixed') {
                    formula = `Fixed amount`;
                  }
                  return (
                    <div key={comp.id} className="flex justify-between text-gray-600">
                      <span>{comp.name}:</span>
                      <span className="font-mono">{formula}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Earnings Table */}
            <div>
              <div className="grid grid-cols-3 gap-4 font-medium text-sm mb-2 text-gray-700">
                <div>EARNINGS</div>
                <div className="text-right">MONTHLY</div>
                <div className="text-right">ANNUALLY</div>
              </div>
              {earningsData.length > 0 ? (
                <>
                  {earningsData.map((e) => {
                    const monthly = e.value;
                    const annual = monthly * 12;
                    return (
                      <div key={e.component.component.id} className="grid grid-cols-3 gap-4 text-sm py-2 border-b">
                        <div className="text-gray-700">{e.component.component.name}</div>
                        <div className="text-right">INR {monthly.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                        <div className="text-right">INR {annual.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                      </div>
                    );
                  })}
                  <div className="grid grid-cols-3 gap-4 text-sm font-medium py-2 bg-gray-100">
                    <div>Total Earnings</div>
                    <div className="text-right">INR {totalEarnings.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                    <div className="text-right">INR {(totalEarnings * 12).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-500 py-2">No earnings configured</p>
              )}
            </div>

            {/* Deductions Table */}
            <div>
              <div className="grid grid-cols-3 gap-4 font-medium text-sm mb-2 text-gray-700">
                <div>DEDUCTIONS</div>
                <div className="text-right">MONTHLY</div>
                <div className="text-right">ANNUALLY</div>
              </div>
              {deductionsData.length > 0 ? (
                <>
                  {deductionsData.map((d) => {
                    const monthly = d.value;
                    const annual = monthly * 12;
                    return (
                      <div key={d.component.component.id} className="grid grid-cols-3 gap-4 text-sm py-2 border-b">
                        <div className="text-gray-700">{d.component.component.name}</div>
                        <div className="text-right">INR {monthly.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                        <div className="text-right">INR {annual.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                      </div>
                    );
                  })}
                  <div className="grid grid-cols-3 gap-4 text-sm font-medium py-2 bg-gray-100">
                    <div>Total Deductions</div>
                    <div className="text-right">INR {totalDeductions.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                    <div className="text-right">INR {(totalDeductions * 12).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-500 py-2">No deductions configured</p>
              )}
            </div>

            {/* Net Pay */}
            <div className="border-t pt-3">
              <div className="grid grid-cols-3 gap-4 text-base font-bold">
                <div>NET PAY</div>
                <div className="text-right text-green-600">INR {(totalEarnings - totalDeductions).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                <div className="text-right text-green-600">INR {((totalEarnings - totalDeductions) * 12).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
              </div>
            </div>

            <button
              onClick={() => {
                setFormData(compensation);
                setEditMode(true);
              }}
              className="mt-4 w-full px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Edit Compensation
            </button>
          </div>
        </div>
      )}

      {editMode && (
        <form onSubmit={handleSave} className="bg-white p-4 rounded-lg border border-gray-200 space-y-3">
          <div className="bg-blue-50 p-3 rounded border border-blue-200">
            <p className="text-xs text-blue-800 font-medium mb-2">Salary Structure Auto-Detection</p>
            <p className="text-xs text-blue-700">Enter annual CTC and the system will automatically assign the matching salary structure:</p>
            <ul className="text-xs text-blue-700 mt-2 space-y-1 ml-3">
              <li>• <strong>Stipend</strong>: ₹15K - ₹20K</li>
              <li>• <strong>3L-5L</strong>: ₹3,00,000 - ₹5,00,000</li>
              <li>• <strong>6L-9L</strong>: ₹6,00,000 - ₹9,00,000</li>
              <li>• <strong>10L-13L</strong>: ₹10,00,000 - ₹13,00,000</li>
              <li>• <strong>14L-17L</strong>: ₹14,00,000 - ₹17,00,000</li>
              <li>• <strong>25L+</strong>: ₹25,00,000+</li>
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Annual CTC (₹) - Cost To Company *
            </label>
            <input
              type="number"
              value={formData.fixed_monthly_amount || ''}
              onChange={(e) => setFormData({ ...formData, fixed_monthly_amount: parseFloat(e.target.value) })}
              placeholder="e.g., 475000 (4.75 Lakh)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              step="10000"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              💡 CTC = Total company pays (includes salary + allowances + employer benefits)
            </p>
          </div>

          {selectedStructure && (
            <div className="bg-gray-50 p-3 rounded border border-gray-200 space-y-3">
              <div>
                <p className="text-sm font-medium mb-2 text-gray-700">Earnings</p>
                <div className="space-y-2">
                  {earnings.map((e) => (
                    <div key={e.component.id} className="flex items-center justify-between">
                      <label className="text-sm text-gray-700">{e.component.name}</label>
                      <input
                        type="number"
                        placeholder={`₹${e.component.default_value || 0}`}
                        value={e.value_override || ''}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                        disabled
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="text-sm font-medium mb-2 text-gray-700">Deductions</p>
                <div className="space-y-2">
                  {deductions.map((d) => (
                    <div key={d.component.id} className="flex items-center justify-between">
                      <label className="text-sm text-gray-700">{d.component.name}</label>
                      <input
                        type="number"
                        placeholder={`₹${d.component.default_value || 0}`}
                        value={d.value_override || ''}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                        disabled
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <input
            type="date"
            value={formData.effective_from ? formData.effective_from.split('T')[0] : ''}
            onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={loadPayrollPreview}
              disabled={previewLoading}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm disabled:opacity-50"
            >
              {previewLoading ? 'Calculating...' : 'Preview Net Pay'}
            </button>
            <button type="submit" className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm">
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditMode(false);
                setFormData({});
                setSelectedStructure(null);
              }}
              className="flex-1 px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Preview Modal */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">Payroll Calculation Preview</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* CTC Header */}
              <div className="pb-4 border-b">
                <h3 className="text-lg font-semibold text-gray-800">
                  Annual CTC: INR {parseFloat(formData.fixed_monthly_amount as any).toLocaleString('en-IN', {
                    maximumFractionDigits: 0,
                  })}
                </h3>
                {previewData?.structure_name && (
                  <p className="text-sm text-gray-600 mt-2">
                    📊 <strong>Assigned Structure:</strong> {previewData.structure_name}
                  </p>
                )}
              </div>

              {/* Earnings */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-3">Earnings (Monthly)</h4>
                <div className="space-y-2">
                  {Object.entries(previewData.earnings || {}).map(([name, amount]) => (
                    <div key={name} className="flex justify-between text-sm">
                      <span className="text-gray-700">{name}</span>
                      <span className="font-medium">INR {(amount as number).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-2">
                    <span>Total Earnings</span>
                    <span className="text-green-600">INR {(previewData.totals?.gross_earnings || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-3">Deductions (Monthly)</h4>
                <div className="space-y-2">
                  {Object.entries(previewData.deductions || {}).map(([name, amount]) => (
                    (amount as number) > 0 && (
                      <div key={name} className="flex justify-between text-sm">
                        <span className="text-gray-700">{name}</span>
                        <span className="font-medium">INR {(amount as number).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                    )
                  ))}
                  <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-2">
                    <span>Total Deductions</span>
                    <span className="text-red-600">INR {(previewData.totals?.total_deductions || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Net Pay */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border-2 border-green-200">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-600 text-sm mb-1">Net Monthly Pay</p>
                    <p className="text-3xl font-bold text-green-600">
                      INR {(previewData.totals?.net_pay || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-600 text-sm mb-1">Net Annual Pay</p>
                    <p className="text-2xl font-bold text-blue-600">
                      INR {((previewData.totals?.net_pay || 0) * 12).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={() => setShowPreview(false)}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!compensation && !editMode && (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">No compensation data</p>
          <button
            onClick={() => setEditMode(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add Compensation
          </button>
        </div>
      )}
    </div>
  );
}
