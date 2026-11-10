import { Users } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import StatePill from "@/components/StatePill";
import ActionForm from "../_components/ActionForm";
import AdminShell from "../_components/AdminShell";
import CreateUserDialog from "../_components/CreateUserDialog";
import FilterForm from "../_components/FilterForm";
import { ROLES, ROLE_THAI, firstParam } from "../_components/shared";
import { resetUserPassword, setUserDisabled, setUserRole } from "../actions";

const ROLE_LABEL = "flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-bold text-fg sm:max-w-44";
const SORTS: Record<string, string> = {
  created_desc: "ใหม่ → เก่า",
  created_asc: "เก่า → ใหม่",
  email: "อีเมล a–z",
};

type UserRow = { id: string; email: string; role: string; disabled: boolean; created_at: Date };

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

export default async function AdminUsersPage({ searchParams }: Props) {
  const me = await requireAdminPage("/admin/users");
  const sp = await searchParams;
  const q = firstParam(sp.q).trim().slice(0, 100);
  const roleParam = firstParam(sp.role);
  const role = (ROLES as readonly string[]).includes(roleParam) ? roleParam : "";
  const statusParam = firstParam(sp.status);
  const status = statusParam === "active" || statusParam === "disabled" ? statusParam : "";
  const sortParam = firstParam(sp.sort);
  const sort = sortParam in SORTS ? sortParam : "created_asc";
  const filtered = Boolean(q || role || status);

  // WHY in memory: this is a hand-sized admin list; one query, then filters here read clearer than SQL plumbing.
  // Explicit column list, so password_hash is never selected and can never reach the client.
  const { rows } = await db.query("select id, email, role, disabled, created_at from users order by created_at, email");
  const all = rows as UserRow[];
  let users = all;
  if (q) {
    const needle = q.toLowerCase();
    users = users.filter((u) => u.email.toLowerCase().includes(needle));
  }
  if (role) users = users.filter((u) => u.role === role);
  if (status) users = users.filter((u) => (status === "disabled") === u.disabled);
  if (sort === "created_desc") users = [...users].reverse();
  else if (sort === "email") users = [...users].sort((a, b) => a.email.localeCompare(b.email));
  const disabled = users.filter((u) => u.disabled).length;

  return (
    <AdminShell
      icon={Users}
      title="ผู้ใช้"
      subtitle={
        filtered
          ? `${users.length} จาก ${all.length} บัญชี · ปิดใช้งาน ${disabled}`
          : `${users.length} บัญชี · ปิดใช้งาน ${disabled}`
      }
      action={<CreateUserDialog />}
    >
      <FilterForm
        ariaLabel="กรองรายชื่อผู้ใช้"
        className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-3 rounded-lg border border-border bg-surface px-5 py-4"
      >
        <label className={ROLE_LABEL}>
          ค้นหาอีเมล
          <input name="q" type="search" defaultValue={q} placeholder="อีเมล…" className="input-field w-full" />
        </label>
        <label className={ROLE_LABEL}>
          บทบาท
          <select name="role" defaultValue={role} className="input-field w-full">
            <option value="">ทุกบทบาท</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_THAI[r]}
              </option>
            ))}
          </select>
        </label>
        <label className={ROLE_LABEL}>
          สถานะ
          <select name="status" defaultValue={status} className="input-field w-full">
            <option value="">ทุกสถานะ</option>
            <option value="active">ใช้งาน</option>
            <option value="disabled">ปิดใช้งาน</option>
          </select>
        </label>
        <label className={ROLE_LABEL}>
          เรียงตาม
          <select name="sort" defaultValue={sort} className="input-field w-full">
            {Object.entries(SORTS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>
      </FilterForm>

      <section aria-labelledby="user-list-heading" className="rounded-lg border border-border bg-surface">
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
        {users.length === 0 && (
          <p className="px-5 py-6 text-center text-sm text-muted">
            {filtered ? "ไม่มีบัญชีที่ตรงกับตัวกรอง" : "ยังไม่มีบัญชีผู้ใช้"}
          </p>
        )}
      </section>
    </AdminShell>
  );
}
