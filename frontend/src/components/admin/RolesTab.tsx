'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminApi,
  ARCHETYPE_OPTIONS,
  REACH_OPTIONS,
  type AdminUser,
  type Archetype,
  type Permission,
  type Role,
  type ScopeTier,
} from '@/lib/admin/api';
import { Badge, Button, ConfirmModal, Drawer, Notice, Select, SectionTitle, errorText } from './ui';
import { RoleBuilder } from './RoleBuilder';

// The seeded starter roles show an "Inbuilt" tag, like Keka's system roles.
const STARTER_ROLES = new Set(['Employee', 'Manager', 'HR Admin', 'Finance']);

const AVATAR_COLORS = [
  'bg-purple-200 text-purple-800',
  'bg-blue-200 text-blue-800',
  'bg-green-200 text-green-800',
  'bg-amber-200 text-amber-800',
  'bg-pink-200 text-pink-800',
  'bg-teal-200 text-teal-800',
];

function initials(u: AdminUser) {
  return `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase() || u.email[0]?.toUpperCase() || '?';
}

// Coarse scope summary from the tiers of a role's grants.
function roleScope(role: Role): { head: string; sub: string; global: boolean } {
  if (role.permissions.length === 0) return { head: 'No access', sub: 'Nothing granted yet', global: false };
  const global = role.permissions.every((g) => g.scopeTier === 'all');
  return global
    ? { head: 'Global', sub: 'Across all employees', global: true }
    : { head: 'Scoped', sub: 'By team / department', global: false };
}

function UserChip({ user, color }: { user: AdminUser; color: string }) {
  const name = `${user.firstName} ${user.lastName}`.trim() || user.email;
  return (
    <span className="inline-flex items-center gap-1.5 bg-gray-100 rounded-full pl-1 pr-2.5 py-0.5 text-xs text-gray-700 max-w-[12rem]">
      <span className={`w-5 h-5 rounded-full grid place-items-center text-[10px] font-semibold ${color}`}>
        {initials(user)}
      </span>
      <span className="truncate">{name}</span>
    </span>
  );
}

export function RolesTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [advancedId, setAdvancedId] = useState<number | null>(null);
  const [builder, setBuilder] = useState<{ role: Role | null } | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, p, u] = await Promise.all([
        adminApi.listRoles(),
        adminApi.listPermissions(),
        adminApi.listUsers({ pageSize: 500 }),
      ]);
      setRoles(r.results);
      setPermissions(p.results);
      setUsers(u.results);
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

  const usersByRole = useMemo(() => {
    const map = new Map<number, AdminUser[]>();
    for (const u of users) {
      if (u.role == null) continue;
      (map.get(u.role) ?? map.set(u.role, []).get(u.role)!).push(u);
    }
    return map;
  }, [users]);

  const advanced = roles.find((r) => r.id === advancedId) ?? null;
  const total = permissions.length;
  const shown = roles.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">User Roles</h2>
          <p className="text-sm text-gray-600 max-w-2xl mt-1">
            User roles can be assigned to employees from here. New roles can be created and privileges
            for all these roles can be managed from this section.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Roles"
            className="w-56 px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <Button variant="primary" onClick={() => setBuilder({ role: null })}>
            + New Role
          </Button>
        </div>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading roles…</p>}
      {error && <Notice tone="error">{error}</Notice>}

      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-[1.6fr_0.9fr_1fr_2fr_auto] gap-4 px-5 py-3 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
            <div>User Roles</div>
            <div>Scope</div>
            <div>Permissions</div>
            <div>Users</div>
            <div>Actions</div>
          </div>
          {shown.map((role) => {
            const scope = roleScope(role);
            const fullAccess = total > 0 && role.permissions.length === total && scope.global;
            const roleUsers = usersByRole.get(role.id) ?? [];
            return (
              <div
                key={role.id}
                className="grid grid-cols-[1.6fr_0.9fr_1fr_2fr_auto] gap-4 px-5 py-4 border-t border-gray-100 items-start"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {STARTER_ROLES.has(role.name) && <Badge tone="purple">Inbuilt</Badge>}
                    {!role.isActive && <Badge tone="red">Inactive</Badge>}
                  </div>
                  <div className="font-semibold text-slate-900">{role.name}</div>
                  {role.description && <p className="text-sm text-gray-500 mt-0.5">{role.description}</p>}
                </div>

                <div className="text-sm">
                  <div className="font-semibold text-slate-900">{scope.head}</div>
                  <div className="text-gray-500">{scope.sub}</div>
                </div>

                <div className="text-sm">
                  <Badge tone={fullAccess ? 'green' : 'gray'}>{fullAccess ? 'Full Access' : 'Limited'}</Badge>
                  <button
                    onClick={() => setBuilder({ role })}
                    className="mt-1.5 block text-purple-600 hover:underline"
                  >
                    {role.permissions.length} / {total} · View
                  </button>
                </div>

                <div>
                  <div className="text-sm text-gray-600 mb-1.5">Added users ({roleUsers.length})</div>
                  <div className="flex flex-wrap gap-1.5">
                    {roleUsers.slice(0, 5).map((u, i) => (
                      <UserChip key={u.id} user={u} color={AVATAR_COLORS[i % AVATAR_COLORS.length]} />
                    ))}
                    {roleUsers.length > 5 && (
                      <span className="text-xs text-gray-500 self-center">+{roleUsers.length - 5} more</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-1.5">
                  <Button onClick={() => setBuilder({ role })}>Edit</Button>
                  <Button onClick={() => setAdvancedId(role.id)}>⋯</Button>
                </div>
              </div>
            );
          })}
          {shown.length === 0 && <p className="px-5 py-6 text-center text-gray-500 text-sm">No roles found.</p>}
        </div>
      )}

      {builder && (
        <RoleBuilder
          role={builder.role}
          permissions={permissions}
          onClose={() => setBuilder(null)}
          onSaved={async () => {
            setBuilder(null);
            await load();
          }}
        />
      )}

      {advanced && (
        <RoleEditor
          key={advanced.id}
          role={advanced}
          permissions={permissions}
          onClose={() => setAdvancedId(null)}
          onChanged={load}
          onDeleted={async () => {
            setAdvancedId(null);
            await load();
          }}
        />
      )}
    </div>
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
