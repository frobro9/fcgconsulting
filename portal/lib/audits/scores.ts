import type { AuditCheck, DimensionKey } from './types'
import { DIMENSIONS } from './types'

// Weight per dimension (must sum to 100)
const DIMENSION_WEIGHTS: Record<DimensionKey, number> = {
  technical_seo: 20,
  performance: 15,
  security: 20,
  mobile: 15,
  accessibility: 10,
  ux_design: 10,
  digital_footprint: 5,
  backlinks: 5,
}

export function calculateOverallScore(checks: AuditCheck[]): number {
  if (checks.length === 0) return 0

  const completedChecks = checks.filter(c => c.status !== 'pending')
  if (completedChecks.length === 0) return 0

  // Group by dimension
  const byDimension: Record<string, number[]> = {}
  for (const check of completedChecks) {
    if (!byDimension[check.dimension]) byDimension[check.dimension] = []
    byDimension[check.dimension].push(check.score)
  }

  let totalWeight = 0
  let weightedScore = 0

  for (const [dimension, scores] of Object.entries(byDimension)) {
    const weight = DIMENSION_WEIGHTS[dimension as DimensionKey] ?? 10
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
    weightedScore += avgScore * weight
    totalWeight += weight
  }

  if (totalWeight === 0) return 0
  return Math.round(weightedScore / totalWeight)
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

export function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800'
  if (score >= 60) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Good'
  if (score >= 60) return 'Needs Work'
  return 'Poor'
}

export function getDimensionScores(checks: AuditCheck[]): Record<string, { score: number; label: string }> {
  const result: Record<string, { score: number; label: string }> = {}

  for (const [key, label] of Object.entries(DIMENSIONS)) {
    const dimChecks = checks.filter(c => c.dimension === key && c.status !== 'pending')
    if (dimChecks.length === 0) {
      result[key] = { score: 0, label }
    } else {
      const avg = Math.round(dimChecks.reduce((a, c) => a + c.score, 0) / dimChecks.length)
      result[key] = { score: avg, label }
    }
  }

  return result
}
