import type { EventDef } from '../game/types';

export function EventScreen({ event, onChoose }: { event: EventDef; onChoose: (id: string) => void }) {
  return (
    <section className="panel screen">
      <header className="bar"><h2>{event.name} / {event.nameEn}</h2></header>
      <p>{event.desc}</p>
      <div className="stack">
        {event.choices.map((c) => (
          <button key={c.id} className="btn block" onClick={() => onChoose(c.id)}>
            <b>{c.label}</b>
            <small>{c.desc}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
