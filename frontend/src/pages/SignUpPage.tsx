import { SignUp } from "@clerk/clerk-react";
import { AuthLayout } from "@/components/layout/AuthLayout";

export function SignUpPage() {
  return (
    <AuthLayout>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        afterSignUpUrl="/dashboard"
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
