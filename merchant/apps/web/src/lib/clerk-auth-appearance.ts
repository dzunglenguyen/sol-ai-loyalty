import type { SignIn } from "@clerk/nextjs";
import type { ComponentProps } from "react";

type ClerkAppearance = NonNullable<ComponentProps<typeof SignIn>["appearance"]>;

const easeOutExpo =
  "[transition-timing-function:cubic-bezier(0.16,1,0.3,1)]" as const;

/**
 * Shared Clerk appearance for /login and /register (dark glass on Shinhan gradient).
 */
export const clerkAuthAppearance: ClerkAppearance = {
  baseTheme: "dark",
  variables: {
    colorPrimary: "#cf9c51",
    colorBackground: "#0f355f",
    colorInputBackground: "rgba(255,255,255,0.09)",
    colorInputText: "#f4f7fb",
    colorText: "#f4f7fb",
    colorTextSecondary: "rgba(244,247,251,0.78)",
    colorNeutral: "#e8ecf2",
    colorDanger: "#fca5a5",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-sans)",
    fontSize: "14px",
  },
  elements: {
    rootBox: "w-full",
    card:
      "bg-[#0f355f]/85 ring-1 ring-white/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] border-0 " +
      `transition-[box-shadow,transform] duration-300 ${easeOutExpo}`,
    headerTitle: "!text-[#f8fafc] !font-semibold tracking-tight",
    headerSubtitle: "!text-[#c8d4e4] !font-normal",
    formHeaderTitle: "!text-[#f8fafc] !font-semibold tracking-tight",
    formHeaderSubtitle: "!text-[#c8d4e4]",
    formFieldLabel: "!text-[#dce4ef] !font-medium text-sm",
    formFieldHintText: "!text-[#9fb0c8] text-xs",
    formFieldErrorText: "!text-red-300 text-sm",
    formFieldInput:
      "!bg-white/[0.1] !text-[#f4f7fb] !border-white/18 !placeholder:text-[#8fa3bd] " +
      `focus:!ring-2 focus:!ring-[#cf9c51]/30 focus:!border-[#cf9c51]/45 ${easeOutExpo} transition-[border-color,box-shadow,background-color] duration-300`,
    identityPreviewText: "!text-[#f4f7fb]",
    identityPreviewEditButton: `!text-[#e5c88a] hover:!text-[#f0d9a8] ${easeOutExpo} transition-colors duration-300`,
    identityPreviewEditButtonIcon: "!text-[#e5c88a]",
    socialButtonsBlockButton:
      "!border !border-white/18 !bg-white/[0.06] !text-[#eef2f8] hover:!bg-white/[0.11] " +
      `active:scale-[0.98] ${easeOutExpo} transition-[transform,background-color,border-color] duration-300`,
    socialButtonsIconButton:
      "!border !border-white/18 !bg-white/[0.06] !text-[#eef2f8] hover:!bg-white/[0.11] " +
      `active:scale-[0.98] ${easeOutExpo} transition-[transform,background-color] duration-300`,
    dividerLine: "!bg-white/18",
    dividerText: "!text-[#8fa3bd] text-xs",
    formButtonPrimary:
      "!bg-gradient-to-r !from-[#c4924a] !to-[#ddb56e] !text-[#0a1f3d] !font-semibold " +
      "!shadow-[0_10px_32px_-10px_rgba(207,156,81,0.45)] hover:!brightness-[1.06] active:scale-[0.98] " +
      `!border-0 ${easeOutExpo} transition-[filter,transform] duration-300`,
    formButtonReset:
      "!text-[#c8d4e4] hover:!text-[#f4f7fb] !border-white/18 !bg-transparent " +
      `active:scale-[0.98] ${easeOutExpo} transition-[color,transform] duration-300`,
    footerAction: "!text-[#8fa3bd]",
    footerActionText: "!text-[#8fa3bd]",
    footerActionLink:
      "!text-[#e5c88a] hover:!text-[#f0d9a8] !font-medium " +
      `${easeOutExpo} transition-colors duration-300`,
    backLink:
      "!text-[#e5c88a] hover:!text-[#f0d9a8] " +
      `${easeOutExpo} transition-colors duration-300`,
    formResendCodeLink:
      "!text-[#e5c88a] hover:!text-[#f0d9a8] " +
      `${easeOutExpo} transition-colors duration-300`,
    otpCodeFieldInput:
      "!bg-white/[0.1] !text-[#f4f7fb] !border-white/18 " +
      `focus:!ring-2 focus:!ring-[#cf9c51]/30 ${easeOutExpo} transition-[border-color,box-shadow] duration-300`,
  },
};
