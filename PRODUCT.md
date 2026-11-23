# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Small traders and shop owners in India. They keep a daily khata in Hindi, Gujarati, or English, and they are not very technical. The first shop in mind is a tailor; the product is for shops in general. They use it at the counter on a Windows PC that fills the desk, and on an Android phone between customers.

## Product Purpose

Ledger AI is the shop's own book: income, expenses, and the balance, kept on the device first and synced when the owner signs in. Success is a correct balance and a new entry written in a few seconds, in the language the shop already uses.

## Positioning

An offline-first khata that speaks English, Hindi, and Gujarati, stores money as integer paise, and can answer questions about the real books. A generic expense app does not import a Daily Ledger backup, shape Indic script in the PDF, or keep working with no account.

## Operating Context

The book is used at the counter while a customer is waiting, and again at the end of the day. Windows is the wide desk. Android is the phone in the hand. The owner already thinks in today's cash, this month, and the running balance.

## Capabilities and Constraints

The shipping app already records income and expenses, opening balance, categories, search, day/month/year/custom totals, backup and restore, Daily Ledger import, PDF and CSV with shaped Gujarati and Hindi, light and dark themes, and an Ask assistant over the real books. Sync is last-write-wins on `updated_at` through a Cloudflare Worker. Money is integer paise. These previews do not change that behavior.

The two surfaces adapt. On Windows the app must use the whole window: a left sidebar and a full-width working area, with no centered phone column and no large empty margins. On a phone the same jobs stay reachable with large tap targets. There is no iOS target.

The most important screens are Home (the balance and today's numbers) and adding an entry quickly.

Confirmed by the owner for this round, not inferred: users, the warm khata feel, the Windows 11 layout demand, the two priority screens, and the references Notion, Linear, and the Windows 11 Settings app. The range to explore is warm-khata-with-clean-structure through clean-Linear/Win11-with-a-touch-of-warmth. The shipping UI stays unchanged until a direction is chosen. No release tag in this round.

## Brand Commitments

The name is Ledger AI. The palette stays marigold yellow, black, and white, in both light and dark. The feel the owner asked for is warm and friendly, like a digital khata book. The references he likes are Notion, Linear, and the Windows 11 Settings app. That tension is binding: the directions must span it, not collapse it into one look.

## Evidence on Hand

Realistic shop entries for the previews are sample data, labeled as such in the preview index, not claims about a real shop. There are no customer testimonials to invent. Daily Ledger is read-only reference and is never modified.

## Product Principles

- The balance and today's numbers are the first thing a shop owner should see.
- Adding an entry is the main action, and it should be reachable without hunting.
- Hindi, Gujarati, and English are equal. Type must stay readable for someone who is not technical.
- The Windows window is the desk. Do not float a phone layout in the middle of it.
- Offline use is the normal case. The cloud is a copy, not the book.

## Accessibility & Inclusion

Shop owners may have older eyes and may not be comfortable with dense English software. Body text stays large on the phone. Contrast meets WCAG AA. Gujarati and Devanagari must use fonts that actually shape those scripts. Motion respects reduced motion.
