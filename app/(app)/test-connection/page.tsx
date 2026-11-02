// Step 2 test page: proves the app can talk to Supabase.
// Open http://localhost:3000/test-connection after logging in.
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import Alert from "@/components/ui/Alert";
import { getCurrentUser } from "@/lib/auth";

export default async function TestConnectionPage() {
  const { supabase, user, profile } = await getCurrentUser();
  const { data, error, count } = await supabase.from("medicines").select("brand_name, strength", { count: "exact" }).limit(5);

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="Supabase connection test" />
      {error ? (
        <Alert kind="error">Connection failed: {error.message}</Alert>
      ) : (
        <Alert kind="success">Connected to Supabase! The medicines table has {count ?? 0} rows you can see.</Alert>
      )}
      <Card title="What the database returned">
        <p className="mb-2 text-sm">
          Logged in as <b>{user.email}</b> · role: <b>{profile?.role ?? "no profile"}</b>
        </p>
        <pre className="overflow-x-auto rounded-lg bg-ink p-4 text-xs text-teal-soft">{JSON.stringify(data, null, 2)}</pre>
      </Card>
    </div>
  );
}
