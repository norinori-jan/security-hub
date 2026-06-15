/**
 * whitehacker-lab への bridge.js 組み込みパッチ
 *
 * whitehacker-lab は index.html 単一ファイル構成のため、
 * 以下を index.html に直接追記する。
 *
 * ① <head> に bridge.js 読み込みを追加
 * ② スキル完了時に completeSkill() を呼ぶ WhiteHackerBridge クラスを追加
 * ③ 既存のスキル完了ロジックから WhiteHackerBridge.onSkillComplete() を呼ぶ
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP 1: index.html <head> に追加する <script> タグ
// Chart.js の読み込みより前に挿入
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/*
  <script src="../security-hub/bridge.js"></script>
*/

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP 2: index.html の <script> 末尾に追加するクラス
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * whitehacker-lab ↔ SecBridge 橋渡し
 *
 * スキル ID と、完了時にアンロックする crypto-vault フィーチャーの対応表。
 * 新しいスキルを追加するときはここに追記するだけでOK。
 */
const SKILL_FEATURE_MAP = {
  'xss-basics':          ['crypto-vault:attack-simulator'],
  'sql-injection':       ['crypto-vault:packet-analyzer'],
  'csrf-defense':        ['crypto-vault:threat-model'],
  'crypto-fundamentals': ['crypto-vault:crypto-playground'],
  'ctf-intro':           ['crypto-vault:ctf-challenge'],
};

class WhiteHackerBridge {
  constructor() {
    this._enabled = typeof SecBridge !== 'undefined';
    if (!this._enabled) {
      console.warn('[WHLab] SecBridge not found — bridge features disabled');
      return;
    }
    console.log('[WHLab] SecBridge connected');
    this._restoreUI();
  }

  /**
   * スキル完了時に呼ぶ。
   * 既存のスキル完了ハンドラから: whBridge.onSkillComplete('xss-basics', 92)
   *
   * @param {string} skillId   SKILL_FEATURE_MAP のキー
   * @param {number} [score]   0–100
   * @param {object} [meta]    追加の非機密メタ情報
   */
  onSkillComplete(skillId, score = null, meta = {}) {
    if (!this._enabled) return;

    const unlocks = SKILL_FEATURE_MAP[skillId] || [];
    const result = SecBridge.completeSkill(skillId, { score, meta, unlocks });

    console.log(`[WHLab] Skill complete: ${skillId}`, result);

    // UI にアンロック通知を表示
    if (result.unlockedFeatures.length > 0) {
      this._showUnlockNotification(skillId, result.unlockedFeatures);
    }

    return result;
  }

  /**
   * ページロード時に既存の完了済みスキルを UI に反映する。
   */
  _restoreUI() {
    if (!this._enabled) return;

    const progress = SecBridge.listProgress();
    for (const [skillId, data] of Object.entries(progress)) {
      this._markSkillCompleted(skillId, data.score);
    }
  }

  /**
   * スキルカードを完了済みとしてマークする。
   * whitehacker-lab の DOM 構造に合わせて調整すること。
   *
   * @param {string} skillId
   * @param {number|null} score
   */
  _markSkillCompleted(skillId, score) {
    // data-skill-id 属性でカードを検索
    const card = document.querySelector(`[data-skill-id="${skillId}"]`);
    if (!card) return;

    card.classList.add('skill-completed');

    if (score !== null) {
      const scoreEl = card.querySelector('.skill-score');
      if (scoreEl) scoreEl.textContent = `${score}点`;
    }
  }

  /**
   * アンロック通知バナーを表示する。
   *
   * @param {string} skillId
   * @param {string[]} features
   */
  _showUnlockNotification(skillId, features) {
    const banner = document.createElement('div');
    banner.className = 'bridge-unlock-banner';
    banner.innerHTML = `
      <span class="unlock-icon">🔓</span>
      <span class="unlock-text">
        <strong>${skillId}</strong> 完了 —
        crypto-vault の新機能がアンロックされました
      </span>
      <button class="unlock-close" onclick="this.parentElement.remove()">✕</button>
    `;

    // スタイル (既存の CSS 変数を流用)
    Object.assign(banner.style, {
      position:     'fixed',
      bottom:       '24px',
      right:        '24px',
      background:   'var(--bg-darker, #050813)',
      border:       '1px solid var(--primary, #00ff41)',
      borderRadius: '8px',
      padding:      '12px 16px',
      display:      'flex',
      alignItems:   'center',
      gap:          '10px',
      color:        'var(--text-light, #e0e0e0)',
      fontFamily:   'var(--mono, monospace)',
      fontSize:     '13px',
      boxShadow:    '0 0 20px rgba(0,255,65,0.3)',
      zIndex:       '9999',
      animation:    'fadeInUp 0.3s ease',
    });

    document.body.appendChild(banner);

    // 5秒後に自動削除
    setTimeout(() => banner.remove(), 5000);
  }

  /**
   * 進捗確認ユーティリティ (デバッグ用)
   */
  getStatus() {
    if (!this._enabled) return { enabled: false };
    return {
      enabled:  true,
      progress: SecBridge.listProgress(),
      unlocks:  SecBridge.listUnlocks(),
    };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP 3: インスタンス生成 (DOMContentLoaded 後)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// グローバルに公開 (既存コードから参照できるよう)
let whBridge;
document.addEventListener('DOMContentLoaded', () => {
  whBridge = new WhiteHackerBridge();
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP 4: 既存スキル完了ハンドラへの組み込み例
//
// whitehacker-lab の既存コードでスキルが完了する箇所を探し、
// 以下のように1行追加するだけでOK:
//
//   whBridge.onSkillComplete('xss-basics', score);
//
// 例: クイズ正解時
//   function onQuizComplete(skillId, score) {
//     // ... 既存処理 ...
//     whBridge.onSkillComplete(skillId, score);   // ← これを追加
//   }
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
