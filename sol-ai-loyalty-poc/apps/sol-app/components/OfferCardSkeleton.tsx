export default function OfferCardSkeleton() {
  return (
    <div
      className="mx-4 mb-3 p-4 rounded-card bg-white animate-pulse"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
      aria-hidden="true"
    >
      {/* Header row */}
      <div className="flex justify-between items-start mb-3">
        <div className="h-5 bg-gray-200 rounded w-2/5" />
        <div className="h-5 bg-gray-200 rounded w-1/5" />
      </div>
      {/* Promo copy */}
      <div className="h-4 bg-gray-200 rounded w-full mb-2" />
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
      {/* Discount + validity */}
      <div className="flex gap-3 mb-4">
        <div className="h-6 bg-gray-200 rounded w-1/4" />
        <div className="h-6 bg-gray-200 rounded w-2/5" />
      </div>
      {/* Button */}
      <div className="h-10 bg-gray-200 rounded-btn w-full" />
    </div>
  );
}
