import { describe, expect, it } from 'vitest'
import { formatInr, formatInrPlain, parseOpeningToPaise, parseRupeesToPaise, rupeesToPaise } from '../src/domain/money'

describe('money', () => {
  it('parses rupees typed by a shopkeeper into paise', () => {
    expect(parseRupeesToPaise('123.45')).toBe(12345)
    expect(parseRupeesToPaise('0.1')).toBe(10)
    expect(parseRupeesToPaise('0')).toBeNull()
    expect(parseRupeesToPaise('12.345')).toBeNull()
    expect(parseOpeningToPaise('0')).toBe(0)
  })

  it('converts imported rupee amounts without losing paise', () => {
    expect(rupeesToPaise(12450)).toBe(1_245_000)
    expect(rupeesToPaise(123.45)).toBe(12345)
    expect(rupeesToPaise(0.1)).toBe(10)
    expect(rupeesToPaise(0.2)).toBe(20)
  })

  it('formats with the rupee sign and lakh grouping', () => {
    expect(formatInr(14_040_000)).toMatch(/₹\s?1,40,400/)
    expect(formatInr(123_456_789)).toMatch(/12,34,567\.89/)
    expect(formatInr(10)).toMatch(/0\.10/)
    expect(formatInrPlain(-145000)).toBe('-1450.00')
    expect(formatInrPlain(80000)).toBe('800.00')
  })
})
