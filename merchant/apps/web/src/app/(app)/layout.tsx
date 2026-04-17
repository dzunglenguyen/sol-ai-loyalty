"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { CopilotKit, useDefaultTool } from "@copilotkit/react-core";
import { BarChart3, BookOpen, LayoutDashboard, LogOut, ShoppingCart } from "lucide-react";
import { setCurrentUserId } from "@/lib/supabase/client";
import { siteCopy } from "@/lib/siteCopy";

const NAV_ITEMS = [
  { href: "/", label: "Chiến dịch", icon: LayoutDashboard },
  { href: "/analytics", label: "Doanh thu", icon: BarChart3 },
  { href: "/knowledge-base", label: "Kho tri thức AI", icon: BookOpen },
  { href: "/pos", label: "Thanh toán", icon: ShoppingCart },
] as const;

function GenericToolCallRenderer() {
  useDefaultTool({
    render: ({ name, args, status, result }) => {
      const statusLabel =
        status === "complete"
          ? siteCopy.copilotTool.complete
          : status === "executing"
            ? siteCopy.copilotTool.executing
            : siteCopy.copilotTool.preparing;

      return (
        <div className="my-2 rounded-lg border border-border-primary/70 bg-surface-secondary/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-text-primary">{name}</p>
            <span className="text-[11px] text-text-tertiary">{statusLabel}</span>
          </div>

          {args && Object.keys(args).length > 0 && (
            <div className="mb-2">
              <p className="text-[11px] font-medium text-text-tertiary">{siteCopy.copilotTool.argsLabel}</p>
              <pre className="mt-1 max-h-40 overflow-auto rounded bg-white/80 p-2 text-[10px] leading-relaxed text-text-secondary">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}

          {status === "complete" && result !== undefined && result !== null && (
            <div>
              <p className="text-[11px] font-medium text-text-tertiary">{siteCopy.copilotTool.resultLabel}</p>
              <pre className="mt-1 max-h-56 overflow-auto rounded bg-status-success-bg/40 p-2 text-[10px] leading-relaxed text-text-secondary">
                {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      );
    },
  });

  return null;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const pathname = usePathname();
  const router = useRouter();

  // Sync Clerk user ID into the Supabase merchant key store
  useEffect(() => {
    setCurrentUserId(user?.id ?? null);
  }, [user?.id]);

  useEffect(() => {
    // Warm route chunks to reduce first-time tab switch latency.
    NAV_ITEMS.forEach((item) => {
      router.prefetch(item.href);
    });
  }, [router]);

  if (!isLoaded) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-shinhan-navy/20 border-t-shinhan-navy rounded-full animate-spin" />
          <p className="text-[13px] text-text-tertiary">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // In local dev without Clerk sign-in, render children directly
    return (
      <CopilotKit showDevConsole={false} runtimeUrl="/api/copilotkit" agent="starterAgent">
        <GenericToolCallRenderer />
        <div className="app-copilot-shell min-h-[100dvh] overflow-x-hidden flex flex-col">
          <nav
            className="sticky top-0 z-[70] border-b border-border-primary/70 bg-white/90 backdrop-blur-xl backdrop-saturate-150
              shadow-[0_1px_0_rgba(0,0,0,0.04)]"
          >
            <div className="w-full min-w-0 px-4 sm:px-5 md:px-8 min-h-12 h-12 flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6">
                <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
                  <Image
                    src="/shinhan-logo.svg"
                    alt="Shinhan Bank"
                    width={100}
                    height={17}
                    className="h-[15px] sm:h-[16px] w-auto"
                    priority
                  />
                  <span className="text-border-primary select-none max-sm:hidden">/</span>
                  <span className="text-[11px] sm:text-[12px] font-medium text-text-secondary tracking-[-0.01em] max-sm:hidden">
                    {siteCopy.product.navProductLabel}
                  </span>
                </div>

                <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg text-[11px] sm:text-[12px] font-medium transition-all duration-200 max-sm:px-2.5 max-sm:py-1.5 sm:px-3 sm:py-1.5 ${
                          active
                            ? "bg-shinhan-blue-light text-shinhan-navy ring-1 ring-shinhan-navy/15"
                            : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
                        }`}
                        title={label}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="max-[380px]:sr-only">{label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <span className="text-[11px] text-text-tertiary">Demo Mode</span>
              </div>
            </div>
          </nav>

          <div className="flex-1">{children}</div>
        </div>
      </CopilotKit>
    );
  }

  return (
    <CopilotKit showDevConsole={false} runtimeUrl="/api/copilotkit" agent="starterAgent">
      <GenericToolCallRenderer />
      <div className="app-copilot-shell min-h-[100dvh] overflow-x-hidden flex flex-col">
        <nav
          className="sticky top-0 z-[70] border-b border-border-primary/70 bg-white/90 backdrop-blur-xl backdrop-saturate-150
            shadow-[0_1px_0_rgba(0,0,0,0.04)]"
        >
          <div className="w-full min-w-0 px-4 sm:px-5 md:px-8 min-h-12 h-12 flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6">
              <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
                <Image
                  src="/shinhan-logo.svg"
                  alt="Shinhan Bank"
                  width={100}
                  height={17}
                  className="h-[15px] sm:h-[16px] w-auto"
                  priority
                />
                <span className="text-border-primary select-none max-sm:hidden">/</span>
                <span className="text-[11px] sm:text-[12px] font-medium text-text-secondary tracking-[-0.01em] max-sm:hidden">
                  {siteCopy.product.navProductLabel}
                </span>
              </div>

              <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg text-[11px] sm:text-[12px] font-medium transition-all duration-200 max-sm:px-2.5 max-sm:py-1.5 sm:px-3 sm:py-1.5 ${
                        active
                          ? "bg-shinhan-blue-light text-shinhan-navy ring-1 ring-shinhan-navy/15"
                          : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
                      }`}
                      title={label}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="max-[380px]:sr-only">{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <span
                className="text-[10px] sm:text-[11px] text-text-tertiary hidden md:block max-w-[200px] truncate text-right"
                title={user.primaryEmailAddress?.emailAddress ?? undefined}
              >
                {user.primaryEmailAddress?.emailAddress}
              </span>
              <button
                type="button"
                aria-label="Thoát"
                onClick={() => signOut(() => router.replace("/login"))}
                className="inline-flex cursor-pointer items-center gap-1 text-[11px] px-2 sm:px-2.5 py-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-surface-secondary transition-colors"
              >
                <LogOut className="w-3 h-3 shrink-0" />
                <span className="max-[380px]:sr-only">Thoát</span>
              </button>
            </div>
          </div>
        </nav>

        <div className="flex-1">{children}</div>
      </div>
    </CopilotKit>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
