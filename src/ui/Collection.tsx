import { useState } from 'react';
import { CHAR_LIST } from '../game/data/characters';
import { ENEMY_LIST } from '../game/data/enemies';
import { LINKS } from '../game/data/links';
import { RELICS } from '../game/data/relics';
import type { MetaSave } from '../game/types';
import { Art, assetUrl, charArt } from './Art';

const TABS = ['valk', 'skins', 'links', 'enemies', 'relics', 'boss', 'rank'] as const;
type Tab = (typeof TABS)[number];

export function Collection({ meta, onBack }: { meta: MetaSave; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('valk');
  return (
    <section className="panel screen">
      <header className="bar">
        <h2>收藏 / Collection</h2>
        <button className="btn" onClick={onBack}>返回</button>
      </header>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {{ valk: '女武神', skins: '塗裝', links: '連攜', enemies: '敵典', relics: '遺物', boss: '首領記憶', rank: '難度' }[t]}
          </button>
        ))}
      </nav>
      <div className="grid">
        {tab === 'valk' && CHAR_LIST.map((c) => {
          const owned = meta.unlockedChars.includes(c.id);
          const seen = meta.seenChars.includes(c.id);
          return (
            <article key={c.id} className={`card ${owned ? '' : 'locked'}`}>
              <Art src={owned || seen ? charArt(c.id, 'portrait') : ''} alt={c.name} color={c.color} fallback={owned || seen ? c.name : '???'} />
              <strong>{owned ? c.name : seen ? c.name : '???'}</strong>
              <small>{owned ? c.nameEn : seen ? '已目擊' : '未發現'}</small>
              {owned && <p>{c.ult.name} / {c.passive.name}</p>}
            </article>
          );
        })}
        {tab === 'skins' && CHAR_LIST.map((c) => {
          const own = meta.unlockedSkins.includes(c.skin.id);
          return (
            <article key={c.skin.id} className={`card ${own ? '' : 'locked'}`}>
              <Art src={own ? charArt(c.id, 'skin') : ''} alt={c.skin.name} color={c.color} fallback={own ? c.skin.name : '???'} />
              <strong>{own ? c.skin.name : '???'}</strong>
              <small>{own ? c.skin.nameEn : '未發現'}</small>
            </article>
          );
        })}
        {tab === 'links' && LINKS.map((l) => {
          const seen = meta.seenLinks.includes(l.id) || (meta.unlockedChars.includes(l.a) && meta.unlockedChars.includes(l.b));
          return (
            <article key={l.id} className={`card ${seen ? '' : 'locked'}`}>
              <Art src={seen ? assetUrl(`assets/links/${l.id}.webp`) : ''} alt={l.name} fallback={seen ? l.name : '???'} />
              <strong>{seen ? l.name : '???'}</strong>
              <small>{seen ? l.nameEn : '未發現'}</small>
              {seen && <p>{l.desc}</p>}
            </article>
          );
        })}
        {tab === 'enemies' && ENEMY_LIST.map((e) => {
          const seen = meta.seenEnemies.includes(e.id) || e.id === 'shade';
          return (
            <article key={e.id} className={`card ${seen ? '' : 'locked'}`}>
              <Art src={seen ? assetUrl(`assets/enemies/${e.id}.webp`) : ''} alt={e.name} color={e.color} fallback={seen ? e.name : '???'} />
              <strong>{seen ? e.name : '???'}</strong>
              <small>{seen ? e.nameEn : '未發現'}</small>
              {seen && <p>{e.desc}</p>}
            </article>
          );
        })}
        {tab === 'relics' && RELICS.map((r) => {
          const owned = meta.unlockedRelics.includes(r.id) || meta.seenRelics.includes(r.id);
          const seen = meta.seenRelics.includes(r.id);
          return (
            <article key={r.id} className={`card ${owned ? '' : 'locked'}`}>
              <strong>{owned || seen ? r.name : '???'}</strong>
              <small>{owned || seen ? r.nameEn : '未發現'}</small>
              {(owned || seen) && <p>{r.desc}</p>}
            </article>
          );
        })}
        {tab === 'boss' && (
          <article className={`card ${meta.seenBoss ? '' : 'locked'}`}>
            <Art src={meta.seenBoss ? assetUrl('assets/boss/yamato-phase2.webp') : ''} alt="YAMATO-0" fallback={meta.seenBoss ? 'YAMATO-0' : '???'} color="#f43f5e" />
            <strong>{meta.seenBoss ? 'YAMATO-0' : '???'}</strong>
            <p>{meta.seenBoss ? '二階段：毀閘、改道、鎖定部署格。' : '未發現的首領記憶。'}</p>
          </article>
        )}
        {tab === 'rank' && (
          <article className="card">
            <strong>難度階級 Difficulty</strong>
            <p>目前：{['月下', '薄蝕', '裂脈', '星殞'][meta.difficulty] ?? '月下'}</p>
            <p>通關次數：{meta.clears}</p>
          </article>
        )}
      </div>
    </section>
  );
}
