import { SignupForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Create account" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return <SignupForm initialEmail={email?.slice(0, 200)} />;
}
