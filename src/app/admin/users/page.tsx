import { Ban, CircleCheck } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { requireAdminPage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import ActionForm from "../_components/ActionForm";
import AdminNav from "../_components/AdminNav";
import { createUser, resetUserPassword, setUserDisabled, setUserRole } from "../actions";

const ROLES = ["viewer", "operator", "admin"];
const input = "input-field w-auto";
const label = "flex flex-col gap-1.5 text-sm font-medium text-muted";

type UserRow = { id: string; email: string; role: string; disabled: boolean; created_at: Date };

export default async function AdminUsersPage() {
  const me = await requireAdminPage("/admin/users");
  // WHY: explicit column list, so password_hash is never selected and can never reach the client.
  const { rows } = await db.query("select id, email, role, disabled, created_at from users order by created_at, email");
  const users = rows as UserRow[];

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader active="admin" isAdmin />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <AdminNav />
        <h1 className="text-xl font-semibold text-fg">Users</h1>

        <section className="card space-y-4">
          <h2 className="font-semibold text-fg">Create user</h2>
          <ActionForm action={createUser} className="flex flex-wrap items-end gap-3">
            <label className={label}>
              Email
              <input name="email" type="email" required maxLength={254} className={input} />
            </label>
            <label className={label}>
              Role
              <select name="role" defaultValue="viewer" className={input}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Password (8+ characters)
              <input name="password" type="password" required minLength={8} maxLength={1024} autoComplete="new-password" className={input} />
            </label>
            <button type="submit" className="btn-primary">
              Create
            </button>
          </ActionForm>
        </section>

        <section className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => {
                // WHY: the UI hides self-lockout controls; the actions refuse them anyway.
                const self = u.id === me.id;
                return (
                  <tr key={u.id} className="align-top transition-colors duration-200 hover:bg-surface-2/50">
                    <td className="px-4 py-3 text-fg">
                      {u.email}
                      {self && <span className="ml-2 text-xs text-muted">(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-fg">
                      {self ? (
                        u.role
                      ) : (
                        <ActionForm action={setUserRole} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="id" value={u.id} />
                          <select name="role" defaultValue={u.role} className={input}>
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="btn-primary">
                            Save
                          </button>
                        </ActionForm>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.disabled ? (
                        <span className="pill bg-danger/10 text-danger ring-danger/40">
                          <Ban className="size-3.5" aria-hidden="true" />
                          Disabled
                        </span>
                      ) : (
                        <span className="pill bg-ok/10 text-ok ring-ok/40">
                          <CircleCheck className="size-3.5" aria-hidden="true" />
                          Active
                        </span>
                      )}
                      {!self && (
                        <ActionForm action={setUserDisabled} className="mt-2">
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="disabled" value={u.disabled ? "false" : "true"} />
                          <button type="submit" className={u.disabled ? "btn-secondary" : "btn-danger"}>
                            {u.disabled ? "Enable" : "Disable"}
                          </button>
                        </ActionForm>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted tabular-nums">{u.created_at.toISOString().slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <ActionForm action={resetUserPassword} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="id" value={u.id} />
                        <input
                          name="password"
                          type="password"
                          required
                          minLength={8}
                          maxLength={1024}
                          autoComplete="new-password"
                          placeholder="New password"
                          aria-label={`New password for ${u.email}`}
                          className={input}
                        />
                        <button type="submit" className="btn-secondary">
                          Reset password
                        </button>
                      </ActionForm>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
