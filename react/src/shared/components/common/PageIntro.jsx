export function PageIntro({ eyebrow, title, description }) {
  return (
    <div className="mb-4">
      {eyebrow ? <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-muted">{eyebrow}</p> : null}
      <h1 className="page-title mt-2">{title}</h1>
      {description ? <p className="page-subtitle mt-2 max-w-3xl">{description}</p> : null}
    </div>
  );
}
