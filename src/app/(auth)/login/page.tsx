import { LoginForm } from "@/components/auth/AuthForms";
import { authErrorMessage } from "@/lib/auth-messages";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string }>;
}) {
  const { error, email } = await searchParams;
  return <LoginForm error={authErrorMessage(error)} email={email?.slice(0, 200)} />;
}
