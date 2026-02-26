export default function Loading() {
  return (
    <div className="pb-6">
      <header className="mb-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="page-label">Catalog</p>
            <h1 className="page-title">Products</h1>
          </div>
          <div className="flex gap-2">
            <div className="skeleton h-9 w-20 rounded-xl" />
            <div className="skeleton h-9 w-20 rounded-xl" />
          </div>
        </div>
        <div className="skeleton mt-3 h-11 rounded-[14px]" />
      </header>

      <section className="card-surface mb-4 p-4">
        <p className="section-title mb-3">Overview</p>
        <div className="grid grid-cols-3 gap-2.5">
          <div className="skeleton h-20 rounded-[14px]" />
          <div className="skeleton h-20 rounded-[14px]" />
          <div className="skeleton h-20 rounded-[14px]" />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <div className="skeleton h-56 rounded-[20px]" />
        <div className="skeleton h-64 rounded-[20px]" />
        <div className="skeleton h-64 rounded-[20px]" />
        <div className="skeleton h-56 rounded-[20px]" />
      </div>
    </div>
  );
}
