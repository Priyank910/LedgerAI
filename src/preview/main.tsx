import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { KhataPreview } from './khata/KhataPreview'
import { ReceiptPreview } from './receipt/ReceiptPreview'
import { SoftPreview } from './soft/SoftPreview'
import './index.css'

function IndexPage() {
  return (
    <main className="opt">
      <h1>Three directions</h1>
      <p>Previews only. The shop app you use every day is unchanged. Colours stay marigold, black, and white.</p>
      <div className="opt-list">
        <a href="/design-options/counter-slip">
          <strong>Counter slip</strong>
          A narrow receipt. The balance is the total printed at the foot of the paper.
        </a>
        <a href="/design-options/soft-till">
          <strong>Soft till</strong>
          Rounded tiles and a pill navigation, set in a face made for older eyes.
        </a>
        <a href="/design-options/khata">
          <strong>Khata</strong>
          A ruled book on the left and a calculator pad on the right.
        </a>
      </div>
    </main>
  )
}

function PreviewRoot() {
  const path = window.location.pathname.replace(/\/$/, '')
  if (path.endsWith('/counter-slip')) return <ReceiptPreview />
  if (path.endsWith('/soft-till')) return <SoftPreview />
  if (path.endsWith('/khata')) return <KhataPreview />
  return <IndexPage />
}

const root = document.getElementById('root')
if (!root) throw new Error('root')
createRoot(root).render(
  <StrictMode>
    <PreviewRoot />
  </StrictMode>,
)
