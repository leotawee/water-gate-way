import AppHeader from "@/components/AppHeader";
import { requireAdminPage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import ActionForm from "../_components/ActionForm";
import AdminNav from "../_components/AdminNav";
import { createUser, resetUserPassword, setUserDisabled, setUserRole } from "../actions";

const ROLES = ["viewer", "operator", "admin"] as const;
const ROLE_THAI: Record<string, string> = { viewer: "ผู้ชม", operator: "ผู้ควบคุม", admin: "ผู้ดูแลระบบ" };
const input = "input-field w-auto";
const label = "flex flex-col gap-1.5 text-sm font-bold text-fg";

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
        <h1 className="text-xl font-bold text-fg">ผู้ใช้</h1>

        <section className="rounded-lg border border-border bg-surface space-y-4 p-4">
          <h2 className="text-base font-bold text-fg">สร้างผู้ใช้</h2>
          <ActionForm action={createUser} className="flex flex-wrap items-end gap-3">
            <label className={label}>
              อีเมล
              <input name="email" type="email" required maxLength={254} className={input} />
            </label>
            <label className={label}>
              บทบาท
              <select name="role" defaultValue="viewer" className={input}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_THAI[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              รหัสผ่าน (8 ตัวอักษรขึ้นไป)
              <input name="password" type="password" required minLength={8} maxLength={1024} autoComplete="new-password" className={input} />
            </label>
            <button type="submit" className="btn-primary whitespace-nowrap">
              สร้าง
            </button>
          </ActionForm>
        </section>

        <section className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="data-table">
            <thead className="bg-surface-2 text-left text-xs font-bold text-muted">
              <tr>
                <th className="px-4 py-3">อีเมล</th>
                <th className="px-4 py-3">บทบาท</th>
                <th className="px-4 py-3">สถานะ</th>
                <th className="px-4 py-3">สร้างเมื่อ</th>
                <th className="px-4 py-3">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => {
                // WHY: the UI hides self-lockout controls; the actions refuse them anyway.
                const self = u.id === me.id;
                return (
                  <tr key={u.id} className="align-top transition-colors duration-150 hover:bg-surface-2/50">
                    <td className="px-4 py-3 text-fg">
                      {u.email}
                      {self && <span className="ml-2 text-xs text-muted">(คุณ)</span>}
                    </td>
                    <td className="px-4 py-3 text-fg">
                      {self ? (
                        ROLE_THAI[u.role] ?? u.role
                      ) : (
                        <ActionForm action={setUserRole} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="id" value={u.id} />
                          <select name="role" defaultValue={u.role} className={input}>
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_THAI[r]}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="btn-secondary whitespace-nowrap">
                            บันทึก
                          </button>
                        </ActionForm>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.disabled ? (
                        <span className="pill bg-danger-soft text-danger">
                          <span className="size-2 rounded-full bg-danger" aria-hidden="true" />
                          ปิดใช้งาน
                        </span>
                      ) : (
                        <span className="pill bg-on-soft text-on">
                          <span className="size-2 rounded-full bg-on" aria-hidden="true" />
                          ใช้งาน
                        </span>
                      )}
                      {!self && (
                        <ActionForm
                          action={setUserDisabled}
                          className="mt-2"
                          confirm={
                            u.disabled
                              ? `เปิดใช้งานบัญชี ${u.email} อีกครั้ง?`
                              : `ปิดใช้งานบัญชี ${u.email}?`
                          }
                        >
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="disabled" value={u.disabled ? "false" : "true"} />
                          <button type="submit" className={`${u.disabled ? "btn-secondary" : "btn-danger"} whitespace-nowrap`}>
                            {u.disabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                          </button>
                        </ActionForm>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted">{u.created_at.toISOString().slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <ActionForm
                        action={resetUserPassword}
                        className="flex flex-wrap items-center gap-2"
                        confirm={`ตั้งรหัสผ่านใหม่ให้ ${u.email}?`}
                      >
                        <input type="hidden" name="id" value={u.id} />
                        <input
                          name="password"
                          type="password"
                          required
                          minLength={8}
                          maxLength={1024}
                          autoComplete="new-password"
                          placeholder="รหัสผ่านใหม่"
                          aria-label={`ตั้งรหัสผ่านใหม่สำหรับ ${u.email}`}
                          className={input}
                        />
                        <button type="submit" className="btn-secondary whitespace-nowrap">
                          ตั้งรหัสผ่านใหม่
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
