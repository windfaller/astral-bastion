export function RestScreen({ onPick }: { onPick: (k: 'heal' | 'mod' | 'core') => void }) {
  return (
    <section className="panel screen">
      <header className="bar"><h2>休整 / Rest</h2></header>
      <p>在高架陰影裡短暫停駐。下一場是 YAMATO-0。</p>
      <div className="grid three">
        <button className="card pick" onClick={() => onPick('heal')}><strong>修復靈核</strong><p>完整加成 +1</p></button>
        <button className="card pick" onClick={() => onPick('mod')}><strong>共鳴校準</strong><p>獲得 共鳴靈脈 模組</p></button>
        <button className="card pick" onClick={() => onPick('core')}><strong>自修協議</strong><p>獲得 檢查點自修</p></button>
      </div>
    </section>
  );
}
