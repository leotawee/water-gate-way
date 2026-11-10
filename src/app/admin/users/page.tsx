import { Users } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ActionForm from "../_components/ActionForm";
import AdminShell from "../_components/AdminShell";
import CreateUserDialog from "../_components/CreateUserDialog";
import FilterForm, { FilterSelect } from "../_components/FilterForm";
import { ROLES, ROLE_THAI, firstParam } from "../_components/shared";
import { resetUserPassword, setUserDisabled, setUserRole } from "../actions";

const SORTS: Record<string, string> = {
  created_desc: "ใหม่ → เก่า",
  created_asc: "เก่า → ใหม่",
  email: "อีเมล a–z",
};

const FIELD = "grid min-w-0 flex-1 gap-1.5 sm:max-w-44";

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
      {/* One surface: the filter toolbar sits inside the list card, so the page reads
          controls-then-content instead of two equal boxes fighting for attention. */}
      <section aria-labelledby="user-list-heading" className="rounded-lg border border-border bg-surface">
        <h2 id="user-list-heading" className="sr-only">
          รายชื่อผู้ใช้
        </h2>
        <div className="border-b border-rule px-5 py-4">
          <FilterForm ariaLabel="กรองรายชื่อผู้ใช้" className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <div className={FIELD}>
              <span className="text-sm font-bold text-fg">ค้นหาอีเมล</span>
              <Input name="q" type="search" defaultValue={q} placeholder="อีเมล…" className="w-full" />
            </div>
            <div className={FIELD}>
              <span className="text-sm font-bold text-fg">บทบาท</span>
              <FilterSelect
                name="role"
                value={role}
                ariaLabel="กรองตามบทบาท"
                className="w-full"
                options={[{ value: "", label: "ทุกบทบาท" }, ...ROLES.map((r) => ({ value: r, label: ROLE_THAI[r] }))]}
              />
            </div>
            <div className={FIELD}>
              <span className="text-sm font-bold text-fg">สถานะ</span>
              <FilterSelect
                name="status"
                value={status}
                ariaLabel="กรองตามสถานะ"
                className="w-full"
                options={[
                  { value: "", label: "ทุกสถานะ" },
                  { value: "active", label: "ใช้งาน" },
                  { value: "disabled", label: "ปิดใช้งาน" },
                ]}
              />
            </div>
            <div className={FIELD}>
              <span className="text-sm font-bold text-fg">เรียงตาม</span>
              <FilterSelect
                name="sort"
                value={sort}
                ariaLabel="เรียงลำดับ"
                className="w-full"
                options={Object.entries(SORTS).map(([value, label]) => ({ value, label }))}
              />
            </div>
          </FilterForm>
        </div>

        <Table className="min-w-full text-sm">
          <TableHeader className="text-left text-sm text-muted">
            <TableRow className="border-rule hover:bg-transparent">
              <TableHead className="px-5 py-3 font-normal text-muted">อีเมล</TableHead>
              <TableHead className="px-5 py-3 font-normal text-muted">บทบาท</TableHead>
              <TableHead className="px-5 py-3 font-normal text-muted">สถานะ</TableHead>
              <TableHead className="px-5 py-3 text-right font-normal text-muted">สร้างเมื่อ</TableHead>
              <TableHead className="px-5 py-3 font-normal text-muted">
                <span className="sr-only">จัดการ</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              // WHY: the UI hides self-lockout controls; the actions refuse them anyway.
              const self = u.id === me.id;
              return (
                <TableRow key={u.id} className="border-rule align-top hover:bg-transparent">
                  <TableCell className="px-5 py-3 font-bold whitespace-nowrap text-fg">
                    <span className="flex min-h-11 items-center">
                      {u.email}
                      {self && <span className="ml-2 font-normal text-muted">(คุณ)</span>}
                    </span>
                  </TableCell>
                  <TableCell className="px-5 py-3 text-fg">
                    {self ? (
                      <span className="flex min-h-11 items-center">{ROLE_THAI[u.role] ?? u.role}</span>
                    ) : (
                      <ActionForm action={setUserRole} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={u.id} />
                        {/* FilterSelect owns the named hidden input; it updates before the submit reads FormData. */}
                        <FilterSelect
                          name="role"
                          value={u.role}
                          ariaLabel={`บทบาทของ ${u.email}`}
                          className="w-36"
                          options={ROLES.map((r) => ({ value: r, label: ROLE_THAI[r] }))}
                        />
                        <Button type="submit" variant="outline" size="sm">
                          บันทึก
                        </Button>
                      </ActionForm>
                    )}
                  </TableCell>
                  <TableCell className="px-5 py-3">
                    <span className="flex min-h-11 items-center">
                      {u.disabled ? (
                        <Badge className="bg-danger-soft text-danger">ปิดใช้งาน</Badge>
                      ) : (
                        <Badge className="bg-on-soft text-on">ใช้งาน</Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="px-5 py-3 text-right text-muted tabular-nums">
                    <span className="flex min-h-11 items-center justify-end">{u.created_at.toISOString().slice(0, 10)}</span>
                  </TableCell>
                  <TableCell className="px-5 py-3">
                    <div className="flex flex-col items-start gap-2">
                      {/* WHY: the reset form stays folded until asked for, so every row is not a row of password boxes. */}
                      <details className="group">
                        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-md px-2.5 text-sm font-semibold text-fg transition-colors duration-150 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                          ตั้งรหัสผ่านใหม่
                        </summary>
                        <ActionForm
                          action={resetUserPassword}
                          className="mt-2 flex flex-wrap items-center gap-2"
                          confirm={`ตั้งรหัสผ่านใหม่ให้ ${u.email}?`}
                        >
                          <input type="hidden" name="id" value={u.id} />
                          <Input
                            name="password"
                            type="password"
                            required
                            minLength={8}
                            maxLength={1024}
                            autoComplete="new-password"
                            aria-label={`รหัสผ่านใหม่สำหรับ ${u.email} (อย่างน้อย 8 ตัวอักษร)`}
                            placeholder="อย่างน้อย 8 ตัวอักษร"
                            className="w-48"
                          />
                          <Button type="submit" variant="outline" size="sm">
                            บันทึกรหัสผ่าน
                          </Button>
                        </ActionForm>
                      </details>
                      {!self && (
                        <ActionForm
                          action={setUserDisabled}
                          confirm={u.disabled ? `เปิดใช้งานบัญชี ${u.email} อีกครั้ง?` : `ปิดใช้งานบัญชี ${u.email}?`}
                        >
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="disabled" value={u.disabled ? "false" : "true"} />
                          <Button
                            type="submit"
                            variant={u.disabled ? "ghost" : "ghostDanger"}
                            size="sm"
                            className="min-h-11 px-2.5"
                          >
                            {u.disabled ? "เปิดใช้งานอีกครั้ง" : "ปิดใช้งานบัญชี"}
                          </Button>
                        </ActionForm>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {users.length === 0 && (
          <p className="px-5 py-6 text-center text-sm text-muted">
            {filtered ? "ไม่มีบัญชีที่ตรงกับตัวกรอง" : "ยังไม่มีบัญชีผู้ใช้"}
          </p>
        )}
      </section>
    </AdminShell>
  );
}
