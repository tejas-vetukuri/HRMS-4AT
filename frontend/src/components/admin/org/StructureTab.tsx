'use client';

import { useCallback, useEffect, useState } from 'react';
import { ORG_KINDS, orgApi, type OrgKind, type OrgUnit } from '@/lib/admin/orgApi';
import { Badge, Button, ConfirmModal, Modal, Notice, Select, errorText } from '../ui';

export function StructureTab({ onChanged }: { onChanged: () => void }) {
  const [kind, setKind] = useState<OrgKind>('departments');
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<OrgUnit | 'new' | null>(null);
  const [deleting, setDeleting] = useState<OrgUnit | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const meta = ORG_KINDS.find((k) => k.kind === kind)!;

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setUnits(await orgApi.listUnits(kind, debounced));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [kind, debounced]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const changed = async () => {
    await load();
    onChanged();
  };

  const toggleActive = async (u: OrgUnit) => {
    setError(null);
    try {
      await orgApi.updateUnit(kind, u.id, { isActive: !u.isActive });
      await changed();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await orgApi.deleteUnit(kind, deleting.id);
      setDeleting(null);
      await changed();
    } catch (e) {
      setDeleteError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="text-sm text-gray-600 max-w-2xl mb-4">
        The lists people are assigned from. Deactivate a unit to stop new assignments while keeping its history; a unit that people still belong to cannot be deleted.
      </p>

      <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Kind of unit">
        {ORG_KINDS.map((k) => (
          <button
            key={k.kind}
            role="tab"
            aria-selected={kind === k.kind}
            onClick={() => {
              setKind(k.kind);
              setSearch('');
            }}
            className={`px-3 py-1.5 rounded-full border text-sm font-semibold ${
              kind === k.kind ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${meta.label.toLowerCase()}…`}
          aria-label={`Search ${meta.label.toLowerCase()}`}
          className="w-full max-w-sm px-4 py-2 border border-gray-300 rounded-lg"
        />
        <Button variant="primary" onClick={() => setEditing('new')}>
          Add {meta.singular}
        </Button>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {!loading && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                {kind === 'cost-centers' && <th className="px-4 py-3 font-semibold">Code</th>}
                <th className="px-4 py-3 font-semibold">People</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">{u.name}</p>
                    {kind === 'departments' && u.parentName && <p className="text-xs text-gray-500">Part of {u.parentName}</p>}
                    {kind === 'departments' && !!u.childCount && <p className="text-xs text-gray-500">{u.childCount} sub-{u.childCount === 1 ? 'department' : 'departments'}</p>}
                  </td>
                  {kind === 'cost-centers' && <td className="px-4 py-3 text-gray-600 font-mono text-xs">{u.code || '—'}</td>}
                  <td className="px-4 py-3 text-gray-700">{u.employeeCount}</td>
                  <td className="px-4 py-3">{u.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge>}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-2">
                      <Button onClick={() => setEditing(u)}>Edit</Button>
                      <Button onClick={() => toggleActive(u)}>{u.isActive ? 'Deactivate' : 'Reactivate'}</Button>
                      <Button variant="danger" onClick={() => setDeleting(u)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {units.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    Nothing here yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <UnitModal
          kind={kind}
          singular={meta.singular}
          unit={editing === 'new' ? null : editing}
          departments={kind === 'departments' ? units : []}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await changed();
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title={`Delete “${deleting.name}”?`}
          body={<p>This permanently removes the {meta.singular}. If people are still assigned to it you will be told, and can deactivate it instead.</p>}
          confirmLabel="Delete"
          danger
          busy={busy}
          error={deleteError}
          onConfirm={remove}
          onCancel={() => {
            setDeleting(null);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
}

function UnitModal({
  kind,
  singular,
  unit,
  departments,
  onClose,
  onSaved,
}: {
  kind: OrgKind;
  singular: string;
  unit: OrgUnit | null;
  departments: OrgUnit[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(unit?.name ?? '');
  const [code, setCode] = useState(unit?.code ?? '');
  const [parent, setParent] = useState<string>(unit?.parent ? String(unit.parent) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: { name: string; code?: string; parent?: number | null } = { name: name.trim() };
      if (kind === 'cost-centers') body.code = code.trim();
      if (kind === 'departments') body.parent = parent ? Number(parent) : null;
      if (unit) await orgApi.updateUnit(kind, unit.id, body);
      else await orgApi.createUnit(kind, body);
      onSaved();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Modal title={unit ? `Edit ${singular}` : `Add ${singular}`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <label className="block">
          <span className="font-semibold text-gray-700">Name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </label>
        {kind === 'cost-centers' && (
          <label className="block">
            <span className="font-semibold text-gray-700">Finance code</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. CC-1042" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </label>
        )}
        {kind === 'departments' && (
          <label className="block">
            <span className="font-semibold text-gray-700">Part of</span>
            <Select aria-label="Parent department" value={parent} onChange={(e) => setParent(e.target.value)} className="mt-1">
              <option value="">Top level</option>
              {departments
                .filter((d) => d.id !== unit?.id)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </Select>
          </label>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy || !name.trim()}>
            {busy ? 'Saving…' : unit ? 'Save' : `Add ${singular}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
