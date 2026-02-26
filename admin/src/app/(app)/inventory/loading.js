export default function Loading() {
  return (
    <div className="space-y-3 pb-6">
      <header>
        <div className="flex items-end justify-between">
          <div>
            <p className="page-label">Stock</p>
            <h1 className="page-title">Inventory</h1>
          </div>
          <div className="skeleton h-9 w-20 rounded-xl" />
        </div>
        <div className="skeleton mt-3 h-11 rounded-[14px]" />
        <div className="mt-2 flex gap-2">
          <div className="skeleton h-8 w-14 rounded-full" />
          <div className="skeleton h-8 w-20 rounded-full" />
          <div className="skeleton h-8 w-24 rounded-full" />
        </div>
      </header>

      <section className="card-surface p-4">
        <p className="section-title mb-3">Overview</p>
        <div className="grid grid-cols-3 gap-2.5">
          <div className="skeleton h-20 rounded-[14px]" />
          <div className="skeleton h-20 rounded-[14px]" />
          <div className="skeleton h-20 rounded-[14px]" />
        </div>
      </section>

      <div className="space-y-2">
        <div className="skeleton h-24 rounded-[18px]" />
        <div className="skeleton h-24 rounded-[18px]" />
        <div className="skeleton h-24 rounded-[18px]" />
      </div>
    </div>
  );
}
