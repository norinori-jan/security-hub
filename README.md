

## �A�g�p�b�` (crypto-vault)
```js
/**
 * crypto-vault への bridge.js 絁E��込みパッチE *
 * 追加場所: integration/VaultApp.js の init() 末尾
 *
 * ① index.html に bridge.js を読み込む
 * ② VaultApp.init() に initBridge() 呼び出しを追加
 * ③ ui/SkillPassport.js に hasFeature() チェチE��を追加
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━E// STEP 1: index.html に追加する <script> タグ
// (既存�E <script src="integration/VaultApp.js"> より前に挿入)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━E
/*
  <script src="../security-hub/bridge.js"></script>
*/

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━E// STEP 2: VaultApp クラスに追加するメソチE��群
// integration/VaultApp.js の init() 末尾に以下を追訁E
//   await this.initBridge();
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━E
const VaultAppBridgeMixin = {

  /**
   * bridge.js との接続を初期化する、E   * SecBridge がロードされてぁE��ぁE��合�Eグレースフルに無効化、E   */
  async initBridge() {
    if (typeof SecBridge === 'undefined') {
      console.warn('[VAULT] SecBridge not found  Ebridge features disabled');
      this._bridgeEnabled = false;
      return;
    }

    this._bridgeEnabled = true;
    console.log('[VAULT] SecBridge connected');

    // whitehacker-lab からのアンロチE��イベントをリチE��ン
    window.addEventListener('secbridge:vault_meta_updated', (e) => {
      this._onBridgeMetaUpdated(e.detail);
    });

    // 起動時に現在のアンロチE��状態を反映
    this._applyBridgeUnlocks();
  },

  /**
   * whitehacker-lab でスキルが完亁E��たとき呼ばれる、E   * vault_meta_updated イベント経由でトリガーされる、E   */
  _onBridgeMetaUpdated(meta) {
    console.log('[VAULT] Bridge meta updated:', meta);
    this._applyBridgeUnlocks();
  },

  /**
   * アンロチE��済みフィーチャーめEUI に反映する、E   * 機寁E��報 (masterPassword 筁E には一刁E��れなぁE��E   */
  _applyBridgeUnlocks() {
    if (!this._bridgeEnabled) return;

    // フィーチャー一覧を確認して UI コンポ�Eネントに通知
    const features = {
      'crypto-vault:packet-analyzer':   SecBridge.hasFeature('crypto-vault:packet-analyzer'),
      'crypto-vault:attack-simulator':  SecBridge.hasFeature('crypto-vault:attack-simulator'),
      'crypto-vault:ctf-challenge':     SecBridge.hasFeature('crypto-vault:ctf-challenge'),
      'crypto-vault:threat-model':      SecBridge.hasFeature('crypto-vault:threat-model'),
      'crypto-vault:crypto-playground': SecBridge.hasFeature('crypto-vault:crypto-playground'),
    };

    console.log('[VAULT] Feature flags:', features);

    // SkillPassport に反映 (ui/SkillPassport.js が存在する場吁E
    if (this.skillPassport && typeof this.skillPassport.applyFeatures === 'function') {
      this.skillPassport.applyFeatures(features);
    }

    // イベントで吁EUI コンポ�Eネントに通知
    window.dispatchEvent(new CustomEvent('vault:features-updated', { detail: features }));
  },

  /**
   * 外部から特定フィーチャーのアンロチE��状態を確認するユーチE��リチE��、E   *
   * @param {string} featureId
   * @returns {boolean}
   */
  isFeatureUnlocked(featureId) {
    if (!this._bridgeEnabled) return false;
    return SecBridge.hasFeature(featureId);
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━E// STEP 3: ui/SkillPassport.js に追加するメソチE��
// SkillPassport クラス冁E��以下を追記すめE// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━E
const SkillPassportBridgeMixin = {

  /**
   * bridge から渡されたフィーチャーフラグめEUI に反映する、E   *
   * @param {Record<string, boolean>} features
   */
  applyFeatures(features) {
    for (const [featureId, unlocked] of Object.entries(features)) {
      // featureId 末尾のキー部刁E(侁E 'packet-analyzer') めEDOM の data 属性と照吁E      const key = featureId.split(':')[1];
      const el = this.el?.querySelector(`[data-feature="${key}"]`);
      if (!el) continue;

      if (unlocked) {
        el.classList.remove('feature-locked');
        el.classList.add('feature-unlocked');
        el.removeAttribute('disabled');
      } else {
        el.classList.add('feature-locked');
        el.classList.remove('feature-unlocked');
      }
    }
  },
};

```

## �A�g�p�b�` (whitehacker-lab)
```js
/**
 * whitehacker-lab への bridge.js 絁E��込みパッチE *
 * whitehacker-lab は index.html 単一ファイル構�Eのため、E * 以下を index.html に直接追記する、E *
 * ① <head> に bridge.js 読み込みを追加
 * ② スキル完亁E��に completeSkill() を呼ぶ WhiteHackerBridge クラスを追加
 * ③ 既存�Eスキル完亁E��ジチE��から WhiteHackerBridge.onSkillComplete() を呼ぶ
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━E// STEP 1: index.html <head> に追加する <script> タグ
// Chart.js の読み込みより前に挿入
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━E
/*
  <script src="../security-hub/bridge.js"></script>
*/

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━E// STEP 2: index.html の <script> 末尾に追加するクラス
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━E
/**
 * whitehacker-lab ↁESecBridge 橋渡ぁE *
 * スキル ID と、完亁E��にアンロチE��する crypto-vault フィーチャーの対応表、E * 新しいスキルを追加するとき�Eここに追記するだけでOK、E */
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
      console.warn('[WHLab] SecBridge not found  Ebridge features disabled');
      return;
    }
    console.log('[WHLab] SecBridge connected');
    this._restoreUI();
  }

  /**
   * スキル完亁E��に呼ぶ、E   * 既存�Eスキル完亁E��ンドラから: whBridge.onSkillComplete('xss-basics', 92)
   *
   * @param {string} skillId   SKILL_FEATURE_MAP のキー
   * @param {number} [score]   0 E00
   * @param {object} [meta]    追加の非機寁E��タ惁E��
   */
  onSkillComplete(skillId, score = null, meta = {}) {
    if (!this._enabled) return;

    const unlocks = SKILL_FEATURE_MAP[skillId] || [];
    const result = SecBridge.completeSkill(skillId, { score, meta, unlocks });

    console.log(`[WHLab] Skill complete: ${skillId}`, result);

    // UI にアンロチE��通知を表示
    if (result.unlockedFeatures.length > 0) {
      this._showUnlockNotification(skillId, result.unlockedFeatures);
    }

    return result;
  }

  /**
   * ペ�Eジロード時に既存�E完亁E��みスキルめEUI に反映する、E   */
  _restoreUI() {
    if (!this._enabled) return;

    const progress = SecBridge.listProgress();
    for (const [skillId, data] of Object.entries(progress)) {
      this._markSkillCompleted(skillId, data.score);
    }
  }

  /**
   * スキルカードを完亁E��みとしてマ�Eクする、E   * whitehacker-lab の DOM 構造に合わせて調整すること、E   *
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
   * アンロチE��通知バナーを表示する、E   *
   * @param {string} skillId
   * @param {string[]} features
   */
  _showUnlockNotification(skillId, features) {
    const banner = document.createElement('div');
    banner.className = 'bridge-unlock-banner';
    banner.innerHTML = `
      <span class="unlock-icon">🔓</span>
      <span class="unlock-text">
        <strong>${skillId}</strong> 完亁E E        crypto-vault の新機�EがアンロチE��されました
      </span>
      <button class="unlock-close" onclick="this.parentElement.remove()">✁E/button>
    `;

    // スタイル (既存�E CSS 変数を流用)
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
   * 進捗確認ユーチE��リチE�� (チE��チE��用)
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━E// STEP 3: インスタンス生�E (DOMContentLoaded 征E
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━E
// グローバルに公閁E(既存コードから参照できるよう)
let whBridge;
document.addEventListener('DOMContentLoaded', () => {
  whBridge = new WhiteHackerBridge();
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━E// STEP 4: 既存スキル完亁E��ンドラへの絁E��込み侁E//
// whitehacker-lab の既存コードでスキルが完亁E��る箁E��を探し、E// 以下�Eように1行追加するだけでOK:
//
//   whBridge.onSkillComplete('xss-basics', score);
//
// 侁E クイズ正解晁E//   function onQuizComplete(skillId, score) {
//     // ... 既存�E琁E...
//     whBridge.onSkillComplete(skillId, score);   // ↁEこれを追加
//   }
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━E
```
