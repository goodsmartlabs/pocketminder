import { SignupForm } from "@/components/auth/AuthForms";
import { authErrorMessage } from "@/lib/auth-messages";

export const metadata = { title: "Create account" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string; name?: string }>;
}) {
  const { error, email, name } = await searchParams;
  return (
    <SignupForm
      error={authErrorMessage(error)}
      email={email?.slice(0, 200)}
      name={name?.slice(0, 80)}
    />
  );
}
