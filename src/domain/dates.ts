export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function isIsoMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false
  const month = Number(value.slice(5, 7))
  return month >= 1 && month <= 12
}

export function isIsoYear(value: string): boolean {
  return /^\d{4}$/.test(value)
}

export function todayLocal(now = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function shiftDay(date: string, delta: number): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10)
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthIndex - 1 + delta, 1))
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${date.getUTCFullYear()}-${nextMonth}`
}

export function shiftYear(year: string, delta: number): string {
  return String(Number(year) + delta)
}

export function lastDayOfMonth(month: string): string {
  const [year, monthIndex] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthIndex, 0))
  return date.toISOString().slice(0, 10)
}

/** ISO timestamps from Postgres and from this device compare equal when they are the same instant. */
export function compareTime(a: string, b: string): number {
  const left = Date.parse(a)
  const right = Date.parse(b)
  if (Number.isNaN(left) || Number.isNaN(right)) {
    if (a === b) return 0
    return a < b ? -1 : 1
  }
  if (left === right) return 0
  return left < right ? -1 : 1
}
