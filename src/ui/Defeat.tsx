export function Defeat({ reason, onDone }: { reason?: string; onDone: () => void }) {
  return (
    <section className="panel screen end-screen lose">
      <h2>護送失敗</h2>
      <p>Defeat — {reason === 'team' ? '女武神全數倒下' : '靈核完整歸零'}</p>
      <button className="btn primary" onClick={onDone}>返回選單</button>
    </section>
  );
}
