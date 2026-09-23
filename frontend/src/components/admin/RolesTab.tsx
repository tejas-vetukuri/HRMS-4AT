'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  adminApi,
  ARCHETYPE_OPTIONS,
  REACH_OPTIONS,
  archetypeLabel,
  type Archetype,
  type Permission,
  type Role,
  type ScopeTier,
} from '@/lib/admin/api';
import { Badge, Button, ConfirmModal, Drawer, Modal, Notice, Select, SectionTitle, errorText } from './ui';

export function RolesTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, p] = await Promise.all([adminApi.listRoles(), adminApi.listPermissions()]);
      setRoles(r.results);
      setPermissions(p.results);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = roles.find((r) => r.id === selectedId) ?? null;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <p className="text-sm text-gray-600 max-w-2xl">
          A role is a set of things people are allowed to do, and how far each one reaches. Everyone has exactly one role.
          Changes apply immediately, including to people who are signed in.
        </p>
        <Button variant="primary" onClick={() => setCreating(true)}>
          New role
        </Button>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading roles…</p>}
      {error && <Notice tone="error">{error}</Notice>}

      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold hidden sm:table-cell">App view</th>
                <th className="px-4 py-3 font-semibold">People</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Permissions</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr
                  key={role.id}
                  onClick={() => setSelectedId(role.id)}
                  className="border-t border-gray-100 hover:bg-purple-50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    <button className="text-left hover:underline" onClick={() => setSelectedId(role.id)}>
                      {role.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{archetypeLabel(role.archetype)}</td>
                  <td className="px-4 py-3 text-gray-600">{role.userCount}</td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{role.permissions.length}</td>
                  <td className="px-4 py-3">{role.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge>}</td>
                </tr>
              ))}
              {roles.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    No roles yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <CreateRoleModal
          onClose={() => setCreating(false)}
          onCreated={async (role) => {
            setCreating(false);
            await load();
            setSelectedId(role.id);
          }}
        />
      )}

      {selected && (
        <RoleEditor
          key={selected.id}
          role={selected}
          permissions={permissions}
          onClose={() => setSelectedId(null)}
          onChanged={load}
          onDeleted={async () => {
            setSelectedId(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function CreateRoleModal({ onClose, onCreated }: { onClose: () => void; onCreated: (r: Role) => void }) {
  const [name, setName] = useState('');
  const [archetype, setArchetype] = useState<Archetype>('employee');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      onCreated(await adminApi.createRole({ name: name.trim(), archetype }));
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Modal title="New role" onClose={onClose}>
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="font-semibold text-gray-700">Role name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Regional HR Partner"
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-gray-700">Which app view does this role get?</span>
          <Select value={archetype} onChange={(e) => setArchetype(e.target.value as Archetype)} className="mt-1">
            {ARCHETYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <span className="text-xs text-gray-500">This only decides which menus the person sees. What they can actually do is set by the permissions you give next.</span>
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create role'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function RoleEditor({
  role,
  permissions,
  onClose,
  onChanged,
  onDeleted,
}: {
  role: Role;
  permissions: Permission[];
  onClose: () => void;
  onChanged: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [name, setName] = useState(role.name);
  const [archetype, setArchetype] = useState<Archetype>(role.archetype);
  const [detailsMsg, setDetailsMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [confirm, setConfirm] = useState<'deactivate' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const detailsChanged = name.trim() !== role.name || archetype !== role.archetype;

  const saveDetails = async () => {
    setSavingDetails(true);
    setDetailsMsg(null);
    try {
      await adminApi.updateRole(role.id, { name: name.trim(), archetype });
      await onChanged();
      setDetailsMsg({ tone: 'success', text: 'Saved.' });
    } catch (e) {
      setDetailsMsg({ tone: 'error', text: errorText(e) });
    } finally {
      setSavingDetails(false);
    }
  };

  const setActive = async (isActive: boolean) => {
    setBusy(true);
    setConfirmError(null);
    try {
      await adminApi.updateRole(role.id, { isActive });
      await onChanged();
      setConfirm(null);
    } catch (e) {
      setConfirmError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setConfirmError(null);
    try {
      await adminApi.deleteRole(role.id);
      await onDeleted();
    } catch (e) {
      setConfirmError(errorText(e));
      setBusy(false);
    }
  };

  const grantFor = (permissionId: number) => role.permissions.find((g) => g.permission === permissionId);

  return (
    <Drawer title={role.name} subtitle={`${role.userCount} ${role.userCount === 1 ? 'person holds' : 'people hold'} this role`} onClose={onClose}>
      <section>
        <SectionTitle>Details</SectionTitle>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="font-semibold text-gray-700">Role name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-gray-700">App view</span>
            <Select value={archetype} onChange={(e) => setArchetype(e.target.value as Archetype)} className="mt-1">
              {ARCHETYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={saveDetails} disabled={!detailsChanged || savingDetails || !name.trim()}>
              {savingDetails ? 'Saving…' : 'Save details'}
            </Button>
            {detailsMsg && <Notice tone={detailsMsg.tone}>{detailsMsg.text}</Notice>}
          </div>
        </div>
      </section>

      <section>
        <SectionTitle hint="For each permission, choose how far this role's holders can reach. Each change saves immediately.">
          What this role can do
        </SectionTitle>
        {!role.isActive && <Notice tone="warning">This role is inactive, so none of the permissions below are in effect.</Notice>}
        <div className="mt-3 border border-gray-200 rounded-xl divide-y divide-gray-100">
          {permissions.map((p) => (
            <GrantRow key={p.id} role={role} permission={p} grantId={grantFor(p.id)?.id} tier={grantFor(p.id)?.scopeTier} onChanged={onChanged} />
          ))}
          {permissions.length === 0 && <p className="p-4 text-sm text-gray-500">No permissions are registered yet.</p>}
        </div>
      </section>

      <section>
        <SectionTitle>Status</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {role.isActive ? (
            <Button
              onClick={() => (role.userCount > 0 ? setConfirm('deactivate') : setActive(false))}
              disabled={busy}
            >
              Deactivate role
            </Button>
          ) : (
            <Button onClick={() => setActive(true)} disabled={busy}>
              Reactivate role
            </Button>
          )}
          <Button variant="danger" onClick={() => setConfirm('delete')}>
            Delete role
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Deactivating removes everything the role grants, straight away, but keeps the role so it can be turned back on. A role that people still hold cannot be deleted.
        </p>
      </section>

      {confirm === 'deactivate' && (
        <ConfirmModal
          title={`Deactivate “${role.name}”?`}
          body={
            <p>
              {role.userCount} {role.userCount === 1 ? 'person holds' : 'people hold'} this role. They will lose everything it grants immediately, even if they are signed in.
              You can reactivate it at any time.
            </p>
          }
          confirmLabel="Deactivate"
          danger
          busy={busy}
          error={confirmError}
          onConfirm={() => setActive(false)}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'delete' && (
        <ConfirmModal
          title={`Delete “${role.name}”?`}
          body={<p>This permanently removes the role and its permission settings. It cannot be undone.</p>}
          confirmLabel="Delete role"
          danger
          busy={busy}
          error={confirmError}
          onConfirm={remove}
          onCancel={() => {
            setConfirm(null);
            setConfirmError(null);
          }}
        />
      )}
    </Drawer>
  );
}

function GrantRow({
  role,
  permission,
  grantId,
  tier,
  onChanged,
}: {
  role: Role;
  permission: Permission;
  grantId?: number;
  tier?: ScopeTier;
  onChanged: () => Promise<void>;
}) {
  const [state, setState] = useState<{ kind: 'idle' | 'saving' | 'saved' | 'error'; text?: string }>({ kind: 'idle' });

  const change = async (value: string) => {
    setState({ kind: 'saving' });
    try {
      if (value === 'none') {
        if (grantId !== undefined) await adminApi.removeGrant(grantId);
      } else if (grantId !== undefined) {
        await adminApi.changeGrant(grantId, value as ScopeTier);
      } else {
        await adminApi.addGrant(role.id, permission.id, value as ScopeTier);
      }
      await onChanged();
      setState({ kind: 'saved' });
    } catch (e) {
      setState({ kind: 'error', text: errorText(e) });
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm">{permission.description || permission.code}</p>
          <p className="text-xs text-gray-500 font-mono">{permission.code}</p>
        </div>
        <div className="w-52 shrink-0">
          <Select
            aria-label={`Reach for ${permission.code}`}
            value={tier ?? 'none'}
            onChange={(e) => change(e.target.value)}
            disabled={state.kind === 'saving'}
          >
            <option value="none">No access</option>
            {REACH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {state.kind === 'saving' && <p className="text-xs text-gray-500 mt-1">Saving…</p>}
      {state.kind === 'saved' && <p className="text-xs text-green-700 mt-1">Saved</p>}
      {state.kind === 'error' && <p className="text-xs text-red-600 mt-1">{state.text}</p>}
    </div>
  );
}
