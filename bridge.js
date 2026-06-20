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

  // ─── ★ TASK5: ロール判定 API（owner / guest / family）───────────────────────
  function getSessionRole() {
    try {
      return localStorage.getItem('sessionRole') || 'owner'
    } catch {
      return 'owner'
    }
  }

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

  function _log(type, payload = {}) {
    const events = _read(KEYS.EVENTS) || []
    events.push({ type, ts: Date.now(), ...payload })
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS)
    _write(KEYS.EVENTS, events)
  }

  // ─── whitehacker-lab 向け API ────────────────────────────────────────────────

  function completeSkill(skillId, opts = {}) {
    if (!skillId || typeof skillId !== 'string') {
      throw new TypeError('[SecBridge] completeSkill: skillId は文字列必須です')
    }

    const { score = null, meta = {}, unlocks = [] } = opts

    const progress = _read(KEYS.PROGRESS) || {}
    progress[skillId] = {
      completedAt: Date.now(),
      score,
      meta,
    }
    _write(KEYS.PROGRESS, progress)

    const currentUnlocks = new Set(_read(KEYS.UNLOCKS) || [])
    const newlyUnlocked = []

    for (const featureId of unlocks) {
      if (!currentUnlocks.has(featureId)) {
        currentUnlocks.add(featureId)
        newlyUnlocked.push(featureId)
      }
    }
    _write(KEYS.UNLOCKS, [...currentUnlocks])

    _syncVaultMeta()
    _log('skill_complete', { skillId, score, unlockedCount: newlyUnlocked.length })

    return { ok: true, unlockedFeatures: newlyUnlocked }
  }

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

  function hasFeature(featureId) {
    const unlocks = new Set(_read(KEYS.UNLOCKS) || [])
    return unlocks.has(featureId)
  }

  function hasFeatures(featureIds) {
    const unlocks = new Set(_read(KEYS.UNLOCKS) || [])
    return Object.fromEntries(featureIds.map(id => [id, unlocks.has(id)]))
  }

  function getVaultMeta() {
    return _read(KEYS.VAULT_META) || {}
  }

  // ─── security-hub 向け汎用 API ───────────────────────────────────────────────

  function listUnlocks() {
    return [...new Set(_read(KEYS.UNLOCKS) || [])]
  }

  function listProgress() {
    return { ...(_read(KEYS.PROGRESS) || {}) }
  }

  function getEvents(limit = 50) {
    const events = _read(KEYS.EVENTS) || []
    return events.slice(-limit).reverse()
  }

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

  function clearAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k))
    _log('clear_all', {})
  }

  // ─── カスタムイベント ───────────────────────────────────────────────────────

  function _dispatchEvent(name, detail) {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('secbridge:' + name, { detail }))
  }

  // ─── vault_meta 同期 ─────────────────────────────────────────────────────────

  function _syncVaultMeta() {
    const progress = _read(KEYS.PROGRESS) || {}
    const unlocks  = _read(KEYS.UNLOCKS)  || []

    const meta = {
      syncedAt:       Date.now(),
      completedSkills: Object.keys(progress).length,
      unlockedCount:  unlocks.length,
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

    // ★ TASK5: ロール判定 API
    getSessionRole,

    // 定数
    KEYS,
  })
}))
