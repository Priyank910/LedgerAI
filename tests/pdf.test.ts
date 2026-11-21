import { readFileSync } from 'node:fs'
import regeneratorRuntime from 'regenerator-runtime'
import { describe, expect, it } from 'vitest'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument } from 'pdf-lib'
import { buildStatementPdf, splitRuns } from '../src/export/pdf'

const runtimeGlobal = globalThis as typeof globalThis & { regeneratorRuntime?: unknown }
runtimeGlobal.regeneratorRuntime = regeneratorRuntime

const fonts = {
  latin: new Uint8Array(readFileSync('public/fonts/NotoSans-Regular.ttf')),
  gujarati: new Uint8Array(readFileSync('public/fonts/NotoSansGujarati-Regular.ttf')),
  devanagari: new Uint8Array(readFileSync('public/fonts/NotoSansDevanagari-Regular.ttf')),
}

describe('pdf', () => {
  it('keeps joiners with the surrounding script', () => {
    const runs = splitRuns('કપડું\u200dક')
    expect(runs.map((run) => run.script)).toEqual(['gujarati'])
  })

  it('shapes Devanagari i-matra before the consonant and embeds Gujarati and Devanagari fonts', async () => {
    const devanagari = fontkit.create(fonts.devanagari)
    const shaped = devanagari.layout('कि')
    const first = shaped.glyphs[0] as { name?: string } | undefined
    expect(first?.name ?? '').toContain('ivowel')
    expect(first?.name ?? '').not.toBe('kadeva')
    const gujarati = fontkit.create(fonts.gujarati)
    expect(gujarati.layout('રમેશ ટેલર્સ').glyphs.length).toBeGreaterThan(4)
    expect(gujarati.familyName).toContain('Gujarati')

    const bytes = await buildStatementPdf(
      {
        shopName: 'રમેશ ટેલર્સ',
        periodLabel: 'ગયા મહિને',
        generatedLabel: 'Ledger AI',
        labels: {
          income: 'આવક',
          expense: 'ખર્ચ',
          net: 'ચોખ્ખું',
          balance: 'બાકી',
          date: 'તારીખ',
          description: 'વિગત',
          category: 'વિભાગ',
          payment: 'ચુકવણી',
          empty: 'કોઈ નોંધ નથી',
        },
        totals: { incomePaise: 12_595_000, expensePaise: 1_402_000, netPaise: 11_193_000, balancePaise: 13_693_000 },
        rows: [
          { date: '15 માર્ચ 2026', title: 'કપડું - સૂટિંગ', category: 'કપડું', payment: 'UPI', note: 'લાલ સૂટિંગ', type: 'expense', amountPaise: 145_000 },
          { date: '14 मार्च 2026', title: 'कपड़ा खरीदी', category: 'कपड़ा', payment: 'नकद', note: 'सूटिंग', type: 'expense', amountPaise: 220_000 },
        ],
      },
      fonts,
    )
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe('%PDF-')
    expect(bytes.byteLength).toBeGreaterThan(8_000)
    const reloaded = await PDFDocument.load(bytes)
    expect(reloaded.getPageCount()).toBe(1)
  })
})
