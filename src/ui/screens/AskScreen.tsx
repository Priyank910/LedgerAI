import { useState } from 'react'
import type { ChatResult, LlmMessage } from '../../domain/ai/loop'
import { formatInr } from '../../domain/money'
import { categoryLabel, formatDate, translate, type MessageKey } from '../../i18n'
import { useBooks } from '../books'

export function AskScreen() {
  const { state, ask } = useBooks()
  const t = (key: MessageKey, vars?: Record<string, string | number>) => translate(state.locale, key, vars)
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState<LlmMessage[]>([])
  const [turns, setTurns] = useState<{ question: string; result?: ChatResult; error?: 'sign-in' | 'unavailable' | 'failed' }[]>([])
  const [busy, setBusy] = useState(false)

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setQuestion('')
    setTurns((current) => [...current, { question: trimmed }])
    try {
      const result = await ask(trimmed, history)
      setHistory(result.messages)
      setTurns((current) => current.map((turn, index) => (index === current.length - 1 ? { ...turn, result } : turn)))
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      const code = message === 'sign-in' ? 'sign-in' : message === 'unavailable' ? 'unavailable' : 'failed'
      setTurns((current) => current.map((turn, index) => (index === current.length - 1 ? { ...turn, error: code } : turn)))
    } finally {
      setBusy(false)
    }
  }

  const suggestions = [t('suggestionCloth'), t('suggestionBalance'), t('suggestionIncome')]

  return (
    <section className="page ask-page">
      <h1>{t('ask')}</h1>
      {turns.length === 0 ? <p className="lede">{t('askEmpty')}</p> : null}
      <div className="suggestions">
        {suggestions.map((item) => (
          <button key={item} type="button" onClick={() => void send(item)} disabled={busy}>
            {item}
          </button>
        ))}
      </div>
      <div className="transcript">
        {turns.map((turn, index) => (
          <article key={`${turn.question}-${index}`} className="turn">
            <p className="question">{turn.question}</p>
            {turn.error === 'sign-in' ? <p role="alert">{t('askNeedSignIn')}</p> : null}
            {turn.error === 'unavailable' ? <p role="alert">{t('askNeedSetup')}</p> : null}
            {turn.error === 'failed' ? <p role="alert">{t('askFailed')}</p> : null}
            {turn.result?.ungrounded ? <p>{t('askUngrounded')}</p> : null}
            {turn.result?.answer ? <p className="answer">{turn.result.answer}</p> : null}
            {turn.result && turn.result.facts.length > 0 ? (
              <div className="facts">
                <h2>{t('fromYourBooks')}</h2>
                {turn.result.facts.map((fact, factIndex) => {
                  if (fact.kind === 'range') return <p key={factIndex}>{t('period')}: {formatDate(fact.from, state.locale)} – {formatDate(fact.to, state.locale)}</p>
                  if (fact.kind === 'money') return <p key={factIndex}><span>{t(fact.label === 'income' ? 'income' : fact.label === 'expense' ? 'expense' : fact.label === 'net' ? 'net' : 'balance')}</span> <strong>{formatInr(fact.paise)}</strong></p>
                  if (fact.kind === 'count') return <p key={factIndex}>{t('countLabel', { count: fact.count })}</p>
                  if (fact.kind === 'lines') {
                    return (
                      <ul key={factIndex}>
                        {fact.lines.map((line) => (
                          <li key={`${line.date}-${line.title}`}>
                            {formatDate(line.date, state.locale)} {line.title} <strong>{formatInr(line.amountPaise)}</strong>
                          </li>
                        ))}
                      </ul>
                    )
                  }
                  return (
                    <ul key={factIndex}>
                      {fact.rows.map((row) => (
                        <li key={row.category}>
                          {categoryLabel(state.locale, row.category)} <strong>{formatInr(row.expensePaise || row.incomePaise)}</strong>
                        </li>
                      ))}
                    </ul>
                  )
                })}
              </div>
            ) : null}
          </article>
        ))}
      </div>
      <form
        className="chat-form"
        onSubmit={(event) => {
          event.preventDefault()
          void send(question)
        }}
      >
        <label className="field">
          {t('ask')}
          <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t('askPlaceholder')} />
        </label>
        <button className="primary" type="submit" disabled={busy || !question.trim()}>
          {busy ? t('working') : t('askSend')}
        </button>
      </form>
    </section>
  )
}
