# bridge.js 使い方ガイド

## 配置

```
(ローカルルート)/
├── bridge.js                   ← SSOT(このファイルを編集する)
├── security-hub/
│   └── index.html
├── whitehacker-lab/
│   ├── bridge.js               ← bridge.jsのコピー
│   └── index.html
└── crypto-vault/
    ├── bridge.js               ← bridge.jsのコピー
    └── index.html
```

bridge.jsを更新したら、各フォルダにコピーして同期する。

-----

## whitehacker-lab 側での使い方

### 読み込み

```html
<script src="./bridge.js"></script>
```

### スキル完了時に呼ぶ

```javascript
const bridge = new SecurityBridge();

// AES-256-GCMモジュールをクリアした瞬間に呼ぶ
const result = bridge.completeSkill('aes-256-gcm');
// → { ok: true, vaultFeature: 'encryption-inspector', alreadyUnlocked: false }

if (result.ok && !result.alreadyUnlocked) {
  showToast('🔐 crypto-vaultの暗号化インスペクターがアンロックされました！');
}
```

### 学習進捗の記録

```javascript
bridge.updateProgress('aes-256-gcm', {
  xp: 300,
  score: 95,
  completedAt: new Date().toISOString()
});
```

### スキル一覧の表示

```javascript
const skills = bridge.getSkillSummary();
// → [{ skillId, label, icon, completed, unlockedAt, vaultFeature }, ...]

skills.forEach(s => {
  console.log(s.icon, s.label, s.completed ? '✅' : '⬜');
});
```

-----

## crypto-vault 側での使い方

### 読み込み

```html
<script src="./bridge.js"></script>
```

### 機能がアンロックされているか確認

```javascript
const bridge = new SecurityBridge();

// 暗号化インスペクターを表示するか判定
if (bridge.hasFeature('encryption-inspector')) {
  document.getElementById('encryptionInspector').classList.remove('hidden');
}

// PBKDF2チューナーを表示するか判定
if (bridge.hasFeature('pbkdf2-tuner')) {
  document.getElementById('pbkdf2Tuner').classList.remove('hidden');
}
```

### アンロックの出所を表示

```javascript
const source = bridge.getFeatureSource('encryption-inspector');
if (source) {
  console.log(`${source.icon} ${source.label}をクリアしてアンロックされました`);
  // → 🔐 AES-256-GCMをクリアしてアンロックされました
}
```

### Vaultのメタ情報を記録(非機密のみ)

```javascript
// Vault起動時・保存時に呼ぶ
bridge.updateVaultMeta({
  entryCount: 42,
  pbkdf2Iterations: 310000,
  encryptionAlgo: 'AES-256-GCM',
  lastUpdated: new Date().toISOString()
});
// ※ パスワード・マスターキー・暗号化Blobは絶対に渡さない
```

-----

## security-hub での使い方

### ダッシュボード全体サマリー

```javascript
const bridge = new SecurityBridge();
const summary = bridge.getSummary();

console.log(`スキル進捗: ${summary.skills.completed}/${summary.skills.total} (${summary.skills.percent}%)`);
console.log(`Vault接続: ${summary.vault.connected}`);
console.log(`アンロック済み機能: ${summary.vault.unlockedFeatures.join(', ')}`);
```

-----

## スキルID一覧

|skillId      |label        |アンロックされるVault機能           |
|-------------|-------------|--------------------------|
|`aes-256-gcm`|AES-256-GCM  |`encryption-inspector`    |
|`pbkdf2`     |PBKDF2鍵導出    |`pbkdf2-tuner`            |
|`k-anonymity`|k-Anonymity  |`leak-check-inspector`    |
|`sqli-basic` |SQLインジェクション基礎|`password-strength-detail`|
|`xss-basic`  |XSS基礎        |`input-sanitizer-view`    |
|`jwt`        |JWT          |`session-inspector`       |
|`ctf-all`    |CTF全クリア      |`advanced-mode`           |

-----

## デバッグ

```javascript
const bridge = new SecurityBridge();
bridge.debug(); // コンソールに全状態を出力

// テスト用リセット(開発時のみ)
bridge.reset(true);
```