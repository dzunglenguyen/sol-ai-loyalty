import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: `
          radial-gradient(100% 70% at 50% -15%, rgba(207, 156, 81, 0.14) 0%, transparent 52%),
          radial-gradient(90% 55% at 100% 50%, rgba(51, 122, 183, 0.22) 0%, transparent 55%),
          radial-gradient(80% 50% at 0% 80%, rgba(0, 57, 127, 0.35) 0%, transparent 50%),
          linear-gradient(168deg, #061326 0%, #0a2548 38%, #0d3a6e 72%, #0f4580 100%)
        `,
      }}
    >
      <div className="absolute inset-0 opacity-[0.025] pointer-events-none">
        <div
          className="w-full h-full"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.9) 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="absolute top-0 right-0 w-[min(100vw,560px)] h-[min(100vw,560px)] rounded-full bg-[#cf9c51]/[0.07] blur-[100px] -translate-y-1/3 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-[420px] h-[420px] rounded-full bg-[#337ab7]/15 blur-[90px] translate-y-1/3 -translate-x-1/4" />

      <div className="relative z-10 w-full max-w-[420px] px-5">
        <div className="flex flex-col items-center mb-7">
          <div className="mb-4 rounded-xl bg-white px-4 py-2.5 shadow-[0_4px_28px_-8px_rgba(0,57,127,0.4)] ring-1 ring-white/30">
            <Image
              src="/shinhan-logo.svg"
              alt="Shinhan Bank"
              width={220}
              height={38}
              className="h-[30px] w-auto md:h-[34px]"
              priority
            />
          </div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#e8d5b2]/90">
            SOL Merchant Platform
          </p>
          <span className="mt-2.5 h-px w-12 bg-gradient-to-r from-transparent via-[#cf9c51]/70 to-transparent" />
        </div>

        <div className="rounded-[1.75rem] bg-white/[0.025] p-1.5 ring-1 ring-white/12 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset] transition-shadow duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]">
          <div className="min-w-0 rounded-[calc(1.75rem-6px)]">{children}</div>
        </div>

        <p className="mt-8 text-center text-[11px] text-white/40">
          Shinhan Bank Vietnam &middot; Hotline: 1900 1577
        </p>
      </div>
    </div>
  );
}
