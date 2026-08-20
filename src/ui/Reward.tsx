import type { RewardOffer } from '../game/types';

export function Reward({ offers, title, onPick }: { offers: RewardOffer[]; title?: string; onPick: (id: string) => void }) {
  return (
    <section className="panel screen">
      <header className="bar"><h2>{title ?? '戰利拾取 / Rewards'}</h2></header>
      <p className="hint">三選一。選擇會改變下一場戰鬥。</p>
      <div className="grid three">
        {offers.map((o) => (
          <button key={o.id} className="card pick" onClick={() => onPick(o.id)}>
            <em>{o.category}</em>
            <strong>{o.name}</strong>
            <small>{o.nameEn}</small>
            <p>{o.desc}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
