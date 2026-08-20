import { assetUrl } from './Art';
export function Victory({ onDone }: { onDone: () => void }) {
  return (
    <section className="panel screen end-screen win">
      <div className="prep-bg" style={{ backgroundImage: `url(${assetUrl('assets/bg/gate.webp')})` }} />
      <h2>星界之門開啟</h2>
      <p>ASTRAL GATE — Victory</p>
      <p>靈核穿越門環。永久解鎖已寫入記憶。</p>
      <button className="btn primary" onClick={onDone}>返回選單</button>
    </section>
  );
}
