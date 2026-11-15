// USERS & ROLES (Admin only) – FR-16.
// New accounts start as Sales Staff; only the Admin can promote them.
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import Alert from "@/components/ui/Alert";
import { Table, Td } from "@/components/ui/Table";
import RoleSelect from "@/components/users/RoleSelect";
import { getCurrentUser, requireRole } from "@/lib/auth";
import type { Profile } from "@/lib/types";

export default async function UsersPage() {
  const { supabase, role, user } = await getCurrentUser();
  requireRole(role, ["admin"]);

  const { data, error } = await supabase.from("profiles").select("id, full_name, age, phone, role, email, created_at").order("created_at");
  const users = (data ?? []) as (Profile & { created_at: string })[];

  return (
    <div className="space-y-4">
      <PageHeader title="Users & Roles" subtitle="Everyone who signs up starts as Sales Staff. Choose a role here to give more access." />
      {error && <Alert kind="error">Could not load users: {error.message}</Alert>}
      <Alert kind="info">
        <b>Admin (Owner)</b>: everything, incl. delete, users, audit log and backups · <b>Pharmacist</b>: stock, suppliers, alerts, forecast,
        returns and disposal · <b>Sales Staff</b>: sales screen and stock lookup only.
      </Alert>
      <Card>
        <Table headers={["Name", "Email", "Phone", "Joined", "Role"]}>
          {users.map((u) => (
            <tr key={u.id}>
              <Td className="font-semibold">
                {u.full_name} {u.id === user.id && <span className="text-xs font-normal text-muted">(you)</span>}
              </Td>
              <Td>{u.email ?? "—"}</Td>
              <Td>{u.phone ?? "—"}</Td>
              <Td>{new Date(u.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</Td>
              <Td>
                <RoleSelect userId={u.id} role={u.role} isMe={u.id === user.id} />
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
