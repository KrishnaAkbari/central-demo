// ---------------------------------------------------------------------------
// invoicePdf — pure function returning printable HTML for a single invoice.
//
// Mock implementation that uses the browser's print-to-PDF mechanism via a
// hidden iframe (see InvoicePdfButton.jsx). Zero new dependencies.
//
// Returns null when the transaction is not a chargeable invoice (negative
// amounts, zero-amount trials, wallet credits). The caller is expected to
// hide the download button for those rows.
//
// Invoice structure (Stripe / Easy-Invoice-PDF reference):
//   ┌────────────────────────────────────────────────┐
//   │  Org name              Invoice #INV-12345       │
//   │  Issuer                Issued 2026-07-16        │
//   │                        Status                   │
//   ├────────────────────────────────────────────────┤
//   │  Bill To                                      │
//   │  Name, Company, Email, Address, Country, Tax   │
//   ├────────────────────────────────────────────────┤
//   │  Items                                        │
//   │  Description            Amount                  │
//   │  Subtotal               $29.00                  │
//   │  Due / Paid             $29.00                  │
//   ├────────────────────────────────────────────────┤
//   │  Payment method: Visa •••• 4242               │
//   └────────────────────────────────────────────────┘
//   Footer: Generated ... · Invoice #{id}
// ---------------------------------------------------------------------------

import { getBillingDetails, getActiveOrgId } from './billingApi'
import { getDefaultCard } from './billingPaymentMethodsApi'

// Transaction types eligible for an invoice PDF. Refunds and credits have
// their own flow (and would produce a credit note) — we don't generate
// invoices for them in this prototype.
const CHARGEABLE_TYPES = new Set(['plan_renewal', 'lifetime_purchase'])

export function isChargeableInvoice(tx) {
  if (!tx) return false
  if (!CHARGEABLE_TYPES.has(tx.type)) return false
  if (typeof tx.amount !== 'number' || tx.amount <= 0) return false
  return true
}

// Format a date as "Jul 16, 2026" (long form) for invoices.
function fmtDate(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

function fmtMoney(n) {
  const v = Number(n) || 0
  const sign = v < 0 ? '-' : ''
  return `${sign}$${Math.abs(v).toFixed(2)}`
}

// HTML-escape user-supplied strings before they're injected into the
// invoice template. Defense in depth — these come from localStorage but
// personas are mock-only so it's mostly a guard against future real data.
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Build the printable HTML for a single invoice. Returns a string ready
// to be written into a hidden iframe and printed.
export function buildInvoiceHtml(tx, opts = {}) {
  if (!isChargeableInvoice(tx)) return null
  const orgId = opts.orgId || getActiveOrgId()
  const orgName = opts.orgName || 'ServerAvatar Customer'
  const details = (orgId && getBillingDetails(orgId)) || {}
  const defaultCard = (orgId && getDefaultCard(orgId)) || null
  const cardLine = defaultCard
    ? `${esc(defaultCard.brand || 'Card')} •••• ${esc(defaultCard.last4 || '0000')}`
    : 'No payment method on file'

  // Invoice number: derive from tx.id with a stable prefix. Real billing
  // systems use a sequential counter; for the prototype we format the
  // mock id so it's recognizable.
  const invoiceNo = `INV-${String(tx.id || '00000').padStart(5, '0')}`

  const issuedAt = fmtDate(tx.createdAt)
  const status = esc((tx.status || 'completed').toUpperCase())
  const description = esc(tx.description || 'Plan charge')
  const planRef = tx.planId ? `Plan: ${esc(tx.planId)}` : ''

  const subtotal = Number(tx.amountDue) || Number(tx.amount) || 0
  const total = Number(tx.amount) || 0
  const paid = total >= 0 ? total : 0
  const due = Math.max(0, subtotal - paid)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice ${esc(invoiceNo)} — ${esc(orgName)}</title>
  <style>
    /* A4 = 794px x 1123px at 96dpi. 0.6in margin = 57.6px on each side.
       Printable area = 794 - 115.2 = 678.8px wide.
       We pad the body by the same 0.6in so screen preview matches print. */
    @page { size: A4; margin: 0.6in; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
      width: 100%;
      max-width: 100%;
      padding: 0.6in;
      overflow-x: hidden;
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 28px; min-width: 0; }
    .issuer { font-size: 18px; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; min-width: 0; flex: 1 1 auto; word-break: break-word; overflow-wrap: anywhere; }
    .issuer-sub { font-size: 11px; color: #64748b; margin-top: 4px; word-break: break-word; overflow-wrap: anywhere; }
    .meta { text-align: right; min-width: 0; flex: 0 1 auto; max-width: 55%; overflow-wrap: anywhere; word-break: break-word; }
    .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
    .meta-value { font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 2px; overflow-wrap: anywhere; word-break: break-word; }
    .meta-status { display: inline-block; padding: 2px 8px; border-radius: 9999px; background: #dcfce7; color: #166534; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 6px; max-width: 100%; overflow-wrap: anywhere; word-break: break-word; }
    .meta-status-failed { background: #fee2e2; color: #991b1b; }
    .meta-status-refunded { background: #fef3c7; color: #92400e; }
    .section { margin-bottom: 22px; }
    .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 6px; }
    .bill-to { font-size: 12px; color: #1e293b; line-height: 1.6; }
    .bill-to .name { font-weight: 600; color: #0f172a; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 8px; table-layout: fixed; }
    table.items th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; font-weight: 600; padding: 8px 0; border-bottom: 1px solid #e2e8f0; overflow-wrap: anywhere; word-break: break-word; }
    table.items th.amt { text-align: right; }
    table.items td { padding: 12px 0; font-size: 12px; color: #0f172a; border-bottom: 1px solid #f1f5f9; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; }
    table.items td.amt { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
    .item-plan { font-size: 11px; color: #64748b; margin-top: 2px; overflow-wrap: anywhere; word-break: break-word; }
    .totals { margin-top: 16px; margin-left: auto; width: 240px; max-width: 100%; }
    .totals-row { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; font-size: 12px; color: #475569; min-width: 0; }
    .totals-row > span:first-child { min-width: 0; overflow-wrap: anywhere; word-break: break-word; }
    .totals-row.total { font-size: 14px; font-weight: 700; color: #0f172a; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 8px; }
    .totals-row .amt { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .pay { margin-top: 24px; padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 11px; color: #475569; }
    .pay .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
    .pay .value { font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 2px; overflow-wrap: anywhere; word-break: break-word; }
    .footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; gap: 16px; min-width: 0; }
    .footer > span { min-width: 0; overflow-wrap: anywhere; word-break: break-word; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="issuer">${esc(orgName)}</div>
      <div class="issuer-sub">Billing statement · ServerAvatar Central Panel</div>
    </div>
    <div class="meta">
      <div class="meta-label">Invoice</div>
      <div class="meta-value">${esc(invoiceNo)}</div>
      <div class="meta-label" style="margin-top: 8px;">Issued</div>
      <div class="meta-value">${esc(issuedAt)}</div>
      <div class="meta-status ${status === 'FAILED' ? 'meta-status-failed' : status === 'REFUNDED' ? 'meta-status-refunded' : ''}">${status}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Bill to</div>
    <div class="bill-to">
      ${details.name ? `<div class="name">${esc(details.name)}</div>` : ''}
      ${details.company ? `<div>${esc(details.company)}</div>` : ''}
      ${details.email ? `<div>${esc(details.email)}</div>` : ''}
      ${details.address ? `<div>${esc(details.address)}</div>` : ''}
      ${details.country ? `<div>${esc(details.country)}</div>` : ''}
      ${details.taxId ? `<div style="margin-top: 4px; color: #64748b;">Tax ID: ${esc(details.taxId)}</div>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Items</div>
    <table class="items">
      <thead>
        <tr>
          <th>Description</th>
          <th class="amt">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div>${description}</div>
            ${planRef ? `<div class="item-plan">${planRef}</div>` : ''}
          </td>
          <td class="amt">${fmtMoney(subtotal)}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row"><span>Subtotal</span><span class="amt">${fmtMoney(subtotal)}</span></div>
      <div class="totals-row total"><span>Total</span><span class="amt">${fmtMoney(total)}</span></div>
      ${due > 0 ? `<div class="totals-row"><span>Due</span><span class="amt">${fmtMoney(due)}</span></div>` : ''}
      ${paid > 0 && paid !== total ? `<div class="totals-row"><span>Paid</span><span class="amt">${fmtMoney(paid)}</span></div>` : ''}
    </div>
  </div>

  <div class="pay">
    <div class="label">Payment method</div>
    <div class="value">${cardLine}</div>
  </div>

  <div class="footer">
    <span>Generated ${esc(fmtDate(new Date().toISOString()))} · ServerAvatar Central Panel</span>
    <span>Invoice ${esc(invoiceNo)}</span>
  </div>
</body>
</html>`
}
