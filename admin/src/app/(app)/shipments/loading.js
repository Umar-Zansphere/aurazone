export default function Loading() {
  return (
    <div className="space-y-3 pb-6">
      <header>
        <div className="flex items-end justify-between">
          <div>
            <p className="page-label">Logistics</p>
            <h1 className="page-title">All shipments</h1>
          </div>
          <div className="skeleton h-9 w-20 rounded-xl" />
        </div>
        <div className="skeleton mt-3 h-11 rounded-[14px]" />
        <div className="mt-2 flex gap-2">
          <div className="skeleton h-8 w-12 rounded-full" />
          <div className="skeleton h-8 w-20 rounded-full" />
          <div className="skeleton h-8 w-20 rounded-full" />
        </div>
      </header>

      <div className="space-y-2">
        <div className="skeleton h-20 rounded-[18px]" />
        <div className="skeleton h-20 rounded-[18px]" />
        <div className="skeleton h-20 rounded-[18px]" />
      </div>
    </div>
  );
}
