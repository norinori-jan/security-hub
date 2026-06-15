/**
 * crypto-vault への bridge.js 組み込みパッチ
 *
 * 追加場所: integration/VaultApp.js の init() 末尾
 *
 * ① index.html に bridge.js を読み込む
 * ② VaultApp.init() に initBridge() 呼び出しを追加
 * ③ ui/SkillPassport.js に hasFeature() チェックを追加
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP 1: index.html に追加する <script> タグ
// (既存の <script src="integration/VaultApp.js"> より前に挿入)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/*
  <script src="../security-hub/bridge.js"></script>
*/

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP 2: VaultApp クラスに追加するメソッド群
// integration/VaultApp.js の init() 末尾に以下を追記:
//   await this.initBridge();
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const VaultAppBridgeMixin = {

  /**
   * bridge.js との接続を初期化する。
   * SecBridge がロードされていない場合はグレースフルに無効化。
   */
  async initBridge() {
    if (typeof SecBridge === 'undefined') {
      console.warn('[VAULT] SecBridge not found — bridge features disabled');
      this._bridgeEnabled = false;
      return;
    }

    this._bridgeEnabled = true;
    console.log('[VAULT] SecBridge connected');

    // whitehacker-lab からのアンロックイベントをリッスン
    window.addEventListener('secbridge:vault_meta_updated', (e) => {
      this._onBridgeMetaUpdated(e.detail);
    });

    // 起動時に現在のアンロック状態を反映
    this._applyBridgeUnlocks();
  },

  /**
   * whitehacker-lab でスキルが完了したとき呼ばれる。
   * vault_meta_updated イベント経由でトリガーされる。
   */
  _onBridgeMetaUpdated(meta) {
    console.log('[VAULT] Bridge meta updated:', meta);
    this._applyBridgeUnlocks();
  },

  /**
   * アンロック済みフィーチャーを UI に反映する。
   * 機密情報 (masterPassword 等) には一切触れない。
   */
  _applyBridgeUnlocks() {
    if (!this._bridgeEnabled) return;

    // フィーチャー一覧を確認して UI コンポーネントに通知
    const features = {
      'crypto-vault:packet-analyzer':   SecBridge.hasFeature('crypto-vault:packet-analyzer'),
      'crypto-vault:attack-simulator':  SecBridge.hasFeature('crypto-vault:attack-simulator'),
      'crypto-vault:ctf-challenge':     SecBridge.hasFeature('crypto-vault:ctf-challenge'),
      'crypto-vault:threat-model':      SecBridge.hasFeature('crypto-vault:threat-model'),
      'crypto-vault:crypto-playground': SecBridge.hasFeature('crypto-vault:crypto-playground'),
    };

    console.log('[VAULT] Feature flags:', features);

    // SkillPassport に反映 (ui/SkillPassport.js が存在する場合)
    if (this.skillPassport && typeof this.skillPassport.applyFeatures === 'function') {
      this.skillPassport.applyFeatures(features);
    }

    // イベントで各 UI コンポーネントに通知
    window.dispatchEvent(new CustomEvent('vault:features-updated', { detail: features }));
  },

  /**
   * 外部から特定フィーチャーのアンロック状態を確認するユーティリティ。
   *
   * @param {string} featureId
   * @returns {boolean}
   */
  isFeatureUnlocked(featureId) {
    if (!this._bridgeEnabled) return false;
    return SecBridge.hasFeature(featureId);
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP 3: ui/SkillPassport.js に追加するメソッド
// SkillPassport クラス内に以下を追記する
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SkillPassportBridgeMixin = {

  /**
   * bridge から渡されたフィーチャーフラグを UI に反映する。
   *
   * @param {Record<string, boolean>} features
   */
  applyFeatures(features) {
    for (const [featureId, unlocked] of Object.entries(features)) {
      // featureId 末尾のキー部分 (例: 'packet-analyzer') を DOM の data 属性と照合
      const key = featureId.split(':')[1];
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
