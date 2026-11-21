import { compareTime } from '../src/domain/dates'

/** A write lands only when it is strictly newer. A tie keeps the row already stored. */
export function acceptServerWrite(existingUpdatedAt: string | null, incomingUpdatedAt: string): boolean {
  if (!existingUpdatedAt) return true
  return compareTime(incomingUpdatedAt, existingUpdatedAt) > 0
}
