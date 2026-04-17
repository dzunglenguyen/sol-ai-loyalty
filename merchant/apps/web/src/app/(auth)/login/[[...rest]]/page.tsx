import { SignIn } from "@clerk/nextjs";
import { clerkAuthAppearance } from "@/lib/clerk-auth-appearance";

export default function LoginPage() {
  return (
    <SignIn
      routing="path"
      path="/login"
      appearance={clerkAuthAppearance}
    />
  );
}
