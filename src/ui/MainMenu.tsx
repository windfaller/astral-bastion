export function MainMenu({ hasRun, onContinue, onNew, onCollection, onSettings }: { hasRun: boolean; onContinue: () => void; onNew: () => void; onCollection: () => void; onSettings: () => void }) {
  return (
    <section className="menu-screen">
      <div className="menu-bg" style={{ backgroundImage: 'url(/assets/bg/title.webp)' }} />
      <div className="menu-shade" />
      <div className="menu-card">
        <p className="eyebrow">INDEPENDENT PROTOTYPE</p>
        <h1>星界堡壘</h1>
        <h2>ASTRAL BASTION</h2>
        <p className="sub">靈脈護送 / Leyline Escort</p>
        <p className="blurb">護送星界核心沿高架靈脈抵達星界之門。守住支線，部署女武神，連結月與鐵。</p>
        <div className="menu-actions">
          {hasRun && <button className="btn primary" onClick={onContinue}>繼續遠征 Continue</button>}
          <button className="btn primary" onClick={onNew}>新的護送 New Run</button>
          <button className="btn" onClick={onCollection}>收藏 Collection</button>
          <button className="btn" onClick={onSettings}>設定 Settings</button>
        </div>
      </div>
    </section>
  );
}
