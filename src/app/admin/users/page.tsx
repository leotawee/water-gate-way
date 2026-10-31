import { requireAdminPage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import ActionForm from "../_components/ActionForm";
import AdminNav from "../_components/AdminNav";
import { createUser, resetUserPassword, setUserDisabled, setUserRole } from "../actions";

const ROLES = ["viewer", "operator", "admin"];
const input = "rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
const button = "rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-1.5 transition-colors";

type UserRow = { id: string; email: string; role: string; disabled: boolean; created_at: Date };

export default async function AdminUsersPage() {
  const me = await requireAdminPage("/admin/users");
  // WHY: explicit column list, so password_hash is never selected and can never reach the client.
  const { rows } = await db.query("select id, email, role, disabled, created_at from users order by created_at, email");
  const users = rows as UserRow[];

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <AdminNav />
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>

        <section className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h2 className="font-semibold text-gray-900">Create user</h2>
          <ActionForm action={createUser} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-sm text-gray-700">
              Email
              <input name="email" type="email" required maxLength={254} className={input} />
            </label>
            <label className="flex flex-col text-sm text-gray-700">
              Role
              <select name="role" defaultValue="viewer" className={input}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm text-gray-700">
              Password (8+ characters)
              <input name="password" type="password" required minLength={8} maxLength={1024} autoComplete="new-password" className={input} />
            </label>
            <button type="submit" className={button}>
              Create
            </button>
          </ActionForm>
        </section>

        <section className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-left text-gray-700">
              <tr>
                <th className="px-4 py-2 font-semibold">Email</th>
                <th className="px-4 py-2 font-semibold">Role</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">Created</th>
                <th className="px-4 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((u) => {
                // WHY: the UI hides self-lockout controls; the actions refuse them anyway.
                const self = u.id === me.id;
                return (
                  <tr key={u.id} className="align-top">
                    <td className="px-4 py-3 text-gray-900">
                      {u.email}
                      {self && <span className="ml-2 text-xs text-gray-500">(you)</span>}
                    </td>
                    <td className="px-4 py-3">
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
                          <button type="submit" className={button}>
                            Save
                          </button>
                        </ActionForm>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {u.disabled ? "Disabled" : "Active"}
                      {!self && (
                        <ActionForm action={setUserDisabled} className="mt-2">
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="disabled" value={u.disabled ? "false" : "true"} />
                          <button type="submit" className={button}>
                            {u.disabled ? "Enable" : "Disable"}
                          </button>
                        </ActionForm>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{u.created_at.toISOString().slice(0, 10)}</td>
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
                        <button type="submit" className={button}>
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
      </div>
    </main>
  );
}
