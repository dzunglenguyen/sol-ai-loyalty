import { SignUp } from "@clerk/nextjs";
import { clerkAuthAppearance } from "@/lib/clerk-auth-appearance";

export default function RegisterPage() {
  return (
    <SignUp
      routing="path"
      path="/register"
      appearance={clerkAuthAppearance}
    />
  );
}
