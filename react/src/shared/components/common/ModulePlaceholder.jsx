import { PageIntro } from "@/shared/components/common/PageIntro";

export function ModulePlaceholder({ eyebrow, title, description, stats = [] }) {
  return (
    <div className="space-y-5">
      <PageIntro eyebrow={eyebrow} title={title} description={description} />

      {stats.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <article key={stat.label} className="erp-stat-card">
              <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-muted">{stat.label}</p>
              <p className="mt-3 text-[28px] font-bold text-ink">{stat.value}</p>
              {stat.note ? <p className="mt-2 text-[11px] text-muted">{stat.note}</p> : null}
            </article>
          ))}
        </section>
      ) : null}

      <section className="table-card">
        <div className="table-toolbar">
          <div>
            <h2 className="text-[13px] font-bold text-ink">Module Shell</h2>
            <p className="text-[11px] text-muted">Ready for table, filters, and action toolbar wiring.</p>
          </div>
          <button type="button" className="erp-button-primary">
            Add Record
          </button>
        </div>
        <div className="px-4 py-10 text-[11px] text-muted">
          This page is scaffolded to match the backend module and can now be connected to the corresponding API hooks.
        </div>
      </section>
    </div>
  );
}
