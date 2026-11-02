// Every page inside the (app) folder needs a logged-in user and gets the sidebar + top bar.
import AppShell from "@/components/layout/AppShell";
import Alert from "@/components/ui/Alert";
import { getCurrentUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, user, role } = await getCurrentUser();

  return (
    <AppShell fullName={profile?.full_name ?? user.email ?? "User"} role={role}>
      {!profile && (
        <div className="mb-4">
          <Alert kind="warning">
            Your profile was not found, so you have Sales Staff access only. Make sure you ran supabase/schema.sql before
            signing up.
          </Alert>
        </div>
      )}
      {children}
    </AppShell>
  );
}
