'use client';

import { useCallback, useEffect, useState } from 'react';
import { request } from '@/lib/admin/api';
import { orgApi, type EmployeeRow } from '@/lib/admin/orgApi';
import { errorText } from '../ui';

export interface Named {
  id: string;
  name: string;
}

export interface Lookups {
  departments: Named[];
  designations: Named[];
  locations: Named[];
  legalEntities: Named[];
  businessUnits: Named[];
  costCenters: Named[];
}

const EMPTY: Lookups = {
  departments: [],
  designations: [],
  locations: [],
  legalEntities: [],
  businessUnits: [],
  costCenters: [],
};

/** Everything the employee screens share: the directory and the pick-lists. */
export function useOrgData() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [lookups, setLookups] = useState<Lookups>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    try {
      setEmployees(await orgApi.listEmployees());
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  const loadLookups = useCallback(async () => {
    try {
      const [departments, designations, locations, legalEntities, businessUnits, costCenters] = await Promise.all([
        request<Named[]>('departments/'),
        request<Named[]>('designations/'),
        request<Named[]>('locations/'),
        request<Named[]>('legal-entities/'),
        request<Named[]>('business-units/'),
        request<Named[]>('cost-centers/'),
      ]);
      setLookups({ departments, designations, locations, legalEntities, businessUnits, costCenters });
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useEffect(() => {
    Promise.all([loadEmployees(), loadLookups()]).finally(() => setLoading(false));
  }, [loadEmployees, loadLookups]);

  return { employees, lookups, loading, error, reloadEmployees: loadEmployees, reloadLookups: loadLookups };
}

export function nameMap(items: Named[]): Record<string, string> {
  return Object.fromEntries(items.map((i) => [i.id, i.name]));
}
