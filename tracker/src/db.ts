import type { Tracker, TrackerCheck } from './types'

export async function listTrackers(db: D1Database): Promise<Tracker[]> {
  const { results } = await db
    .prepare('SELECT * FROM trackers ORDER BY created_at DESC')
    .all<Tracker>()
  return results ?? []
}

export async function getTracker(db: D1Database, id: string): Promise<Tracker | null> {
  return db.prepare('SELECT * FROM trackers WHERE id = ?').bind(id).first<Tracker>()
}

export async function getRecentChecks(
  db: D1Database,
  trackerId: string,
  limit = 30,
): Promise<TrackerCheck[]> {
  const { results } = await db
    .prepare(
      'SELECT * FROM tracker_checks WHERE tracker_id = ? ORDER BY checked_at DESC LIMIT ?',
    )
    .bind(trackerId, limit)
    .all<TrackerCheck>()
  return results ?? []
}

export type NewTracker = {
  kind: 'flight' | 'item'
  label: string
  url: string
  price_selector: string | null
  currency: string
  target_price: number | null
  interval_hours: number
}

export async function createTracker(db: D1Database, t: NewTracker): Promise<string> {
  const id = crypto.randomUUID()
  await db
    .prepare(
      `INSERT INTO trackers (id, kind, label, url, price_selector, currency, target_price, interval_hours)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      t.kind,
      t.label,
      t.url,
      t.price_selector,
      t.currency,
      t.target_price,
      t.interval_hours,
    )
    .run()
  return id
}

export type TrackerUpdate = {
  label: string
  url: string
  price_selector: string | null
  currency: string
  target_price: number | null
  interval_hours: number
  active: number
}

export async function updateTracker(
  db: D1Database,
  id: string,
  u: TrackerUpdate,
): Promise<void> {
  await db
    .prepare(
      `UPDATE trackers
         SET label = ?, url = ?, price_selector = ?, currency = ?,
             target_price = ?, interval_hours = ?, active = ?
       WHERE id = ?`,
    )
    .bind(
      u.label,
      u.url,
      u.price_selector,
      u.currency,
      u.target_price,
      u.interval_hours,
      u.active,
      id,
    )
    .run()
}

export async function deleteTracker(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM trackers WHERE id = ?').bind(id).run()
}

/** Trackers that are active and due for a check based on their interval. */
export async function dueTrackers(db: D1Database, limit = 50): Promise<Tracker[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM trackers
        WHERE active = 1
          AND (
            last_checked_at IS NULL
            OR last_checked_at < datetime('now', printf('-%d hours', interval_hours))
          )
        ORDER BY last_checked_at IS NOT NULL, last_checked_at ASC
        LIMIT ?`,
    )
    .bind(limit)
    .all<Tracker>()
  return results ?? []
}

export async function recordCheck(
  db: D1Database,
  row: {
    tracker_id: string
    price: number | null
    currency: string | null
    status: 'ok' | 'error'
    error: string | null
    notified: boolean
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO tracker_checks (id, tracker_id, price, currency, status, error, notified)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      row.tracker_id,
      row.price,
      row.currency,
      row.status,
      row.error,
      row.notified ? 1 : 0,
    )
    .run()
}

export async function applyCheckToTracker(
  db: D1Database,
  id: string,
  fields: {
    last_price: number | null
    last_status: 'ok' | 'error'
    last_error: string | null
    baseline_price?: number | null
  },
): Promise<void> {
  if (fields.baseline_price !== undefined) {
    await db
      .prepare(
        `UPDATE trackers
           SET last_price = ?, last_status = ?, last_error = ?,
               baseline_price = ?, last_checked_at = datetime('now')
         WHERE id = ?`,
      )
      .bind(
        fields.last_price,
        fields.last_status,
        fields.last_error,
        fields.baseline_price,
        id,
      )
      .run()
  } else {
    await db
      .prepare(
        `UPDATE trackers
           SET last_price = ?, last_status = ?, last_error = ?,
               last_checked_at = datetime('now')
         WHERE id = ?`,
      )
      .bind(fields.last_price, fields.last_status, fields.last_error, id)
      .run()
  }
}
