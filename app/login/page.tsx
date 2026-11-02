import AuthCard from "@/components/auth/AuthCard";
import LoginForm from "@/components/auth/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ signedup?: string }> }) {
  const { signedup } = await searchParams;
  return (
    <AuthCard title="Log in to your pharmacy">
      <LoginForm justSignedUp={signedup === "1"} />
    </AuthCard>
  );
}
