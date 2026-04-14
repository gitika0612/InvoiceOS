import { SignIn } from "@clerk/clerk-react";
import { AuthLayout } from "@/components/layout/AuthLayout";

export function SignInPage() {
  return (
    <AuthLayout>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        afterSignInUrl="/dashboard"
        appearance={{
          variables: {
            colorPrimary: "#4F46E5",
            colorText: "#111827",
            colorTextSecondary: "#6B7280",
            colorBackground: "#ffffff",
            colorInputBackground: "#ffffff",
            colorInputText: "#111827",
            borderRadius: "10px",
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: "14px",
          },
        }}
      />
    </AuthLayout>
  );
}
