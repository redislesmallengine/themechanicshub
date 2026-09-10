import { listRoles } from "@/lib/rbac";
import { InviteStaffForm } from "@/components/invite-staff-form";

export default async function InviteStaffPage() {
  const roles = await listRoles();
  return <InviteStaffForm roles={roles} />;
}
