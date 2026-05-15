export function SectionCard({ eyebrow, title, description, children, className = "" }) {
  return (
    <section className={`card ${className}`.trim()}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2>{title}</h2>
      {description ? <p className="muted lead">{description}</p> : null}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function FieldRow({ children }) {
  return <div className="field-row">{children}</div>;
}

export function StatusBanner({ tone = "neutral", children }) {
  return <div className={`status-banner ${tone}`}>{children}</div>;
}
