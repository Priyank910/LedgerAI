import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { EntryLine } from './directions/EntryLine'
import { OpenKhata } from './directions/OpenKhata'
import { ShopRail } from './directions/ShopRail'
import { KhataPreview } from './khata/KhataPreview'
import { ReceiptPreview } from './receipt/ReceiptPreview'
import { SoftPreview } from './soft/SoftPreview'
import './index.css'

function IndexPage() {
  return (
    <main className="opt">
      <h1>Directions for the desk</h1>
      <p>Previews only. The shop app you use every day is unchanged. Sample books, not a real shop. Colours stay marigold, black, and white.</p>
      <div className="opt-list">
        <a href="/design-options/open-khata?lang=gu">
          <strong>Open khata</strong>
          A full-window account book. The balance closes the page like a khata, and a new entry is the next ruled line.
        </a>
        <a href="/design-options/shop-rail?lang=en">
          <strong>Shop rail</strong>
          A Windows 11 settings shell, warmed with marigold. The balance is the page title, and a new entry opens in the page.
        </a>
        <a href="/design-options/entry-line?lang=en">
          <strong>Entry line</strong>
          A dense ledger across the window. One strip shows the balance and today, and a new entry is typed into the table.
        </a>
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
  if (path.endsWith('/open-khata')) return <OpenKhata />
  if (path.endsWith('/shop-rail')) return <ShopRail />
  if (path.endsWith('/entry-line')) return <EntryLine />
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
