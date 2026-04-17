export default function AppLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-shinhan-navy/20 border-t-shinhan-navy rounded-full animate-spin" />
        <p className="text-[13px] text-text-tertiary">Đang chuyển tab...</p>
      </div>
    </div>
  );
}
