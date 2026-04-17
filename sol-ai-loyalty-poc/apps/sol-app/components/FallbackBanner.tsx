export default function FallbackBanner() {
  return (
    <div
      className="mx-4 mb-3 px-4 py-3 rounded-card text-sm flex items-center gap-2"
      style={{
        backgroundColor: "#FFF8F0",
        border: "1px solid #FF6B00",
        color: "#FF6B00",
      }}
      role="status"
      aria-live="polite"
    >
      <span className="text-base">⚠️</span>
      <span>Đang hiển thị theo thứ tự mới nhất</span>
    </div>
  );
}
