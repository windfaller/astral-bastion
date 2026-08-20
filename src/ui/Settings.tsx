import type { SettingsState } from '../game/types';

export function Settings({ settings, onChange, onBack }: { settings: SettingsState; onChange: (s: SettingsState) => void; onBack: () => void }) {
  return (
    <section className="panel screen">
      <header className="bar">
        <h2>設定 / Settings</h2>
        <button className="btn" onClick={onBack}>返回</button>
      </header>
      <div className="stack">
        <label>動畫速度
          <select value={settings.animSpeed} onChange={(e) => onChange({ ...settings, animSpeed: e.target.value as SettingsState['animSpeed'] })}>
            <option value="normal">普通 Normal</option>
            <option value="fast">快速 Fast</option>
            <option value="skip">跳過 Skip</option>
          </select>
        </label>
        <label className="row">
          <input type="checkbox" checked={settings.mute} onChange={(e) => onChange({ ...settings, mute: e.target.checked })} />
          靜音 Mute
        </label>
        <p className="hint">跳過動畫不會改變戰鬥結算——模擬先擲骰，畫面只是回放。</p>
      </div>
    </section>
  );
}
