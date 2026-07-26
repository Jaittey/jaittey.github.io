export default function ModuleHub({ eyebrow, title, description, items, onOpen }) {
  return (
    <>
      <section className="module-hero panel">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </section>
      <section className="module-card-grid">
        {items.map((item) => (
          <article className="module-card panel" key={item.title}>
            <span className="module-card-icon">{item.icon || '◆'}</span>
            <div>
              <div className="module-card-heading"><h3>{item.title}</h3><small className={item.ready ? 'ready' : 'planned'}>{item.ready ? 'Available' : 'Planned'}</small></div>
              <p>{item.description}</p>
              <ul>{(item.features || []).slice(0, 5).map((feature) => <li key={feature}>{feature}</li>)}</ul>
            </div>
            {item.page && <button className="button button-secondary" onClick={() => onOpen(item.page)}>Open</button>}
          </article>
        ))}
      </section>
    </>
  );
}
