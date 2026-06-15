/**
 * bridge.js — security-hub ブリッジレイヤー
 *
 * 役割:
 *   whitehacker-lab → completeSkill()  → LocalStorage
 *   crypto-vault    → hasFeature()     → LocalStorage (読み取り)
 *   security-hub    → 両方に対してオーケストレーション
 *
 * LocalStorage キー:
 *   secbridge_unlocks    — アンロック済みフィーチャーの Set (JSON 配列)
 *   secbridge_progress   — スキル進捗マップ { skillId: { completedAt, score, meta } }
 *   secbridge_vault_meta — crypto-vault 向け非機密メタ情報
 *   secbridge_events     — イベントログ (リングバッファ, 最大 200 件)
 *
 * ⚠️  セキュリティ原則:
 *   - パスワード・暗号鍵・トークン等の機密情報は絶対に bridge 経由で流さない
 *   - 非機密メタ情報 (スキル完了フラグ, スコア, タイムスタンプ) のみ扱う
 */

;(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory()          // CommonJS (Node / Jest)
  } else {
    root.SecBridge = factory()          // ブラウザグローバル
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict'

  // ─── 定数 ────────────────────────────────────────────────────────────────────

  const KEYS = Object.freeze({
    UNLOCKS:    'secbridge_unlocks',
    PROGRESS:   'secbridge_progress',
    VAULT_META: 'secbridge_vault_meta',
    EVENTS:     'secbridge_events',
  })

  const MAX_EVENTS = 200

  // ─── ストレージユーティリティ ────────────────────────────────────────────────

  function _read(key) {
    try {
      const raw = localStorage.getItem(key)
      return raw !== null ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  function _write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch (e) {
      console.warn('[SecBridge] localStorage write failed:', key, e)
      return false
    }
  }

  // ─── イベントログ ────────────────────────────────────────────────────────────

  /**
   * 内部イベントをリングバッファに追記する。
   * @param {string} type  イベント種別
   * @param {object} payload 追加メタ (機密情報を含めないこと)
   */
  function _log(type, payload = {}) {
    const events = _read(KEYS.EVENTS) || []
    events.push({ type, ts: Date.now(), ...payload })
    // リングバッファ: 古いものを切り捨て
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS)
    _write(KEYS.EVENTS, events)
  }

  // ─── whitehacker-lab 向け API ────────────────────────────────────────────────

  /**
   * スキル完了を記録し、対応するフィーチャーをアンロックする。
   *
   * @param {string} skillId   スキル識別子 (例: 'xss-basics', 'sql-injection')
   * @param {object} [opts]
   * @param {number}  [opts.score]    0–100 のスコア
   * @param {object}  [opts.meta]     追加の非機密メタ情報
   * @param {string[]} [opts.unlocks] このスキル完了でアンロックするフィーチャー ID 一覧
   * @returns {{ ok: boolean, unlockedFeatures: string[] }}
   */
  function completeSkill(skillId, opts = {}) {
    if (!skillId || typeof skillId !== 'string') {
      throw new TypeError('[SecBridge] completeSkill: skillId は文字列必須です')
    }

    const { score = null, meta = {}, unlocks = [] } = opts

    // 進捗を更新
    const progress = _read(KEYS.PROGRESS) || {}
    progress[skillId] = {
      completedAt: Date.now(),
      score,
      meta,
    }
    _write(KEYS.PROGRESS, progress)

    // アンロック
    const currentUnlocks = new Set(_read(KEYS.UNLOCKS) || [])
    const newlyUnlocked = []

    for (const featureId of unlocks) {
      if (!currentUnlocks.has(featureId)) {
        currentUnlocks.add(featureId)
        newlyUnlocked.push(featureId)
      }
    }
    _write(KEYS.UNLOCKS, [...currentUnlocks])

    // vault_meta を同期
    _syncVaultMeta()

    _log('skill_complete', { skillId, score, unlockedCount: newlyUnlocked.length })

    return { ok: true, unlockedFeatures: newlyUnlocked }
  }

  /**
   * スキルの進捗情報を取得する。
   *
   * @param {string} skillId
   * @returns {{ completed: boolean, completedAt: number|null, score: number|null, meta: object }}
   */
  function getSkillProgress(skillId) {
    const progress = _read(KEYS.PROGRESS) || {}
    const entry = progress[skillId] || null
    return {
      completed: entry !== null,
      completedAt: entry?.completedAt ?? null,
      score:       entry?.score ?? null,
      meta:        entry?.meta  ?? {},
    }
  }

  // ─── crypto-vault 向け API ───────────────────────────────────────────────────

  /**
   * フィーチャーがアンロック済みかどうかを返す。
   *
   * @param {string} featureId
   * @returns {boolean}
   */
  function hasFeature(featureId) {
    const unlocks = new Set(_read(KEYS.UNLOCKS) || [])
    return unlocks.has(featureId)
  }

  /**
   * 複数フィーチャーを一括確認する。
   *
   * @param {string[]} featureIds
   * @returns {Record<string, boolean>}
   */
  function hasFeatures(featureIds) {
    const unlocks = new Set(_read(KEYS.UNLOCKS) || [])
    return Object.fromEntries(featureIds.map(id => [id, unlocks.has(id)]))
  }

  /**
   * crypto-vault が参照できる非機密メタ情報スナップショットを返す。
   *
   * @returns {object}
   */
  function getVaultMeta() {
    return _read(KEYS.VAULT_META) || {}
  }

  // ─── security-hub 向け汎用 API ───────────────────────────────────────────────

  /**
   * アンロック済みフィーチャー一覧を返す。
   *
   * @returns {string[]}
   */
  function listUnlocks() {
    return [...new Set(_read(KEYS.UNLOCKS) || [])]
  }

  /**
   * 全スキル進捗マップを返す。
   *
   * @returns {Record<string, object>}
   */
  function listProgress() {
    return { ...(_read(KEYS.PROGRESS) || {}) }
  }

  /**
   * イベントログを返す (新しい順)。
   *
   * @param {number} [limit=50]
   * @returns {object[]}
   */
  function getEvents(limit = 50) {
    const events = _read(KEYS.EVENTS) || []
    return events.slice(-limit).reverse()
  }

  /**
   * 特定スキルの完了を取り消す (デバッグ・テスト用)。
   * ⚠️  本番環境での使用は推奨しない。
   *
   * @param {string} skillId
   * @param {string[]} [revokeFeatures=[]] 同時に取り消すフィーチャー ID
   */
  function resetSkill(skillId, revokeFeatures = []) {
    const progress = _read(KEYS.PROGRESS) || {}
    delete progress[skillId]
    _write(KEYS.PROGRESS, progress)

    if (revokeFeatures.length) {
      const unlocks = new Set(_read(KEYS.UNLOCKS) || [])
      revokeFeatures.forEach(f => unlocks.delete(f))
      _write(KEYS.UNLOCKS, [...unlocks])
    }

    _syncVaultMeta()
    _log('skill_reset', { skillId })
  }

  /**
   * bridge のすべてのデータを消去する (デバッグ・テスト用)。
   */
  function clearAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k))
    _log('clear_all', {})
  }

  // ─── カスタムイベント (window 向け) ──────────────────────────────────────────

  /**
   * DOM CustomEvent を使って同一ウィンドウ内の他フレームに通知する。
   * cross-origin iframe からは受け取れないため、機密情報の漏洩リスクなし。
   *
   * @param {string} name
   * @param {object} detail
   */
  function _dispatchEvent(name, detail) {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('secbridge:' + name, { detail }))
  }

  // ─── 内部: vault_meta 同期 ──────────────────────────────────────────────────

  function _syncVaultMeta() {
    const progress = _read(KEYS.PROGRESS) || {}
    const unlocks  = _read(KEYS.UNLOCKS)  || []

    const meta = {
      syncedAt:       Date.now(),
      completedSkills: Object.keys(progress).length,
      unlockedCount:  unlocks.length,
      // スキル ID 一覧 (非機密) だけを共有
      skillIds:       Object.keys(progress),
      featureIds:     unlocks,
    }

    _write(KEYS.VAULT_META, meta)
    _dispatchEvent('vault_meta_updated', meta)
  }

  // ─── 公開 API ────────────────────────────────────────────────────────────────

  return Object.freeze({
    // whitehacker-lab
    completeSkill,
    getSkillProgress,

    // crypto-vault
    hasFeature,
    hasFeatures,
    getVaultMeta,

    // security-hub / 汎用
    listUnlocks,
    listProgress,
    getEvents,
    resetSkill,
    clearAll,

    // 定数 (外部参照用)
    KEYS,
  })
}))