import { Users } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import StatePill from "@/components/StatePill";
import ActionForm from "../_components/ActionForm";
import AdminShell from "../_components/AdminShell";
import { createUser, resetUserPassword, setUserDisabled, setUserRole } from "../actions";

const ROLES = ["viewer", "operator", "admin"] as const;
const ROLE_THAI: Record<string, string> = { viewer: "ผู้ชม", operator: "ผู้ควบคุม", admin: "ผู้ดูแลระบบ" };
const label = "flex flex-col gap-1.5 text-sm font-bold text-fg";

type UserRow = { id: string; email: string; role: string; disabled: boolean; created_at: Date };

export default async function AdminUsersPage() {
  const me = await requireAdminPage("/admin/users");
  // WHY: explicit column list, so password_hash is never selected and can never reach the client.
  const { rows } = await db.query("select id, email, role, disabled, created_at from users order by created_at, email");
  const users = rows as UserRow[];
  const disabled = users.filter((u) => u.disabled).length;

  return (
    <AdminShell icon={Users} title="ผู้ใช้" subtitle={`${users.length} บัญชี · ปิดใช้งาน ${disabled}`}>
      <section aria-labelledby="create-user-heading" className="rounded-lg border border-border bg-surface p-5">
        <h2 id="create-user-heading" className="text-base font-bold text-fg">
          สร้างผู้ใช้
        </h2>
        <ActionForm
          action={createUser}
          className="mt-4 grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_auto]"
        >
          <label className={label}>
            อีเมล
            <input name="email" type="email" required maxLength={254} className="input-field w-full" />
          </label>
          <label className={label}>
            บทบาท
            <select name="role" defaultValue="viewer" className="input-field w-full">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_THAI[r]}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            รหัสผ่าน
            <input
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={1024}
              autoComplete="new-password"
              aria-describedby="create-password-rule"
              className="input-field w-full"
            />
          </label>
          <button type="submit" className="btn-primary whitespace-nowrap">
            สร้างผู้ใช้
          </button>
          <p id="create-password-rule" className="col-span-full -mt-2 text-sm text-muted">
            รหัสผ่านอย่างน้อย 8 ตัวอักษร
          </p>
        </ActionForm>
      </section>

      <section aria-labelledby="user-list-heading" className="mt-6 rounded-lg border border-border bg-surface">
        <h2 id="user-list-heading" className="sr-only">
          รายชื่อผู้ใช้
        </h2>
        {/* WHY: the table scrolls inside its own frame on a phone; the page never scrolls sideways. */}
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead className="text-left text-sm text-muted">
              <tr>
                <th className="px-5 py-3 font-normal">อีเมล</th>
                <th className="px-5 py-3 font-normal">บทบาท</th>
                <th className="px-5 py-3 font-normal">สถานะ</th>
                <th className="px-5 py-3 text-right font-normal">สร้างเมื่อ</th>
                <th className="px-5 py-3 font-normal">
                  <span className="sr-only">จัดการ</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                // WHY: the UI hides self-lockout controls; the actions refuse them anyway.
                const self = u.id === me.id;
                return (
                  <tr key={u.id} className="border-t border-rule align-top">
                    <td className="px-5 py-3 font-bold whitespace-nowrap text-fg">
                      <span className="flex min-h-11 items-center">
                        {u.email}
                        {self && <span className="ml-2 font-normal text-muted">(คุณ)</span>}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-fg">
                      {self ? (
                        <span className="flex min-h-11 items-center">{ROLE_THAI[u.role] ?? u.role}</span>
                      ) : (
                        <ActionForm action={setUserRole} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={u.id} />
                          <select
                            name="role"
                            defaultValue={u.role}
                            aria-label={`บทบาทของ ${u.email}`}
                            className="input-field w-36"
                          >
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
                    <td className="px-5 py-3">
                      <span className="flex min-h-11 items-center">
                        {u.disabled ? (
                          <StatePill tone="danger">ปิดใช้งาน</StatePill>
                        ) : (
                          <StatePill tone="on">ใช้งาน</StatePill>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-muted tabular-nums">
                      <span className="flex min-h-11 items-center justify-end">{u.created_at.toISOString().slice(0, 10)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col items-start gap-2">
                        {/* WHY: the reset form stays folded until asked for, so every row is not a row of password boxes. */}
                        <details className="group">
                          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-md px-2 text-sm font-bold text-fg transition-colors duration-150 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                            ตั้งรหัสผ่านใหม่
                          </summary>
                          <ActionForm
                            action={resetUserPassword}
                            className="mt-2 flex flex-wrap items-center gap-2"
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
                              aria-label={`รหัสผ่านใหม่สำหรับ ${u.email} (อย่างน้อย 8 ตัวอักษร)`}
                              placeholder="อย่างน้อย 8 ตัวอักษร"
                              className="input-field w-48"
                            />
                            <button type="submit" className="btn-secondary whitespace-nowrap">
                              บันทึกรหัสผ่าน
                            </button>
                          </ActionForm>
                        </details>
                        {!self && (
                          <ActionForm
                            action={setUserDisabled}
                            confirm={u.disabled ? `เปิดใช้งานบัญชี ${u.email} อีกครั้ง?` : `ปิดใช้งานบัญชี ${u.email}?`}
                          >
                            <input type="hidden" name="id" value={u.id} />
                            <input type="hidden" name="disabled" value={u.disabled ? "false" : "true"} />
                            <button
                              type="submit"
                              className={`inline-flex min-h-11 cursor-pointer items-center rounded-md px-2 text-sm font-bold transition-colors duration-150 ${
                                u.disabled ? "text-fg hover:bg-surface-2" : "text-danger hover:bg-danger-soft"
                              }`}
                            >
                              {u.disabled ? "เปิดใช้งานอีกครั้ง" : "ปิดใช้งานบัญชี"}
                            </button>
                          </ActionForm>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
