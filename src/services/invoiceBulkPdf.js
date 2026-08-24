// ---------------------------------------------------------------------------
// invoiceBulkPdf — pure function returning printable HTML for a bulk
// export of chargeable invoices. Each invoice is its own page; a summary
// page sits at the top.
//
// Same hidden-iframe + print approach as the per-row flow. See
// InvoicePdfButton.jsx and InvoicePdfBulkButton.jsx.
// ---------------------------------------------------------------------------

import { buildInvoiceHtml, isChargeableInvoice } from './invoicePdf'
import { getBillingDetails, getActiveOrgId } from './billingApi'
import { getDefaultCard } from './billingPaymentMethodsApi'

function fmtMoney(n) {
  const v = Number(n) || 0
  const sign = v < 0 ? '-' : ''
  return `${sign}$${Math.abs(v).toFixed(2)}`
}

function fmtDateShort(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildBulkInvoiceHtml(transactions, opts = {}) {
  const orgId = opts.orgId || getActiveOrgId()
  const orgName = opts.orgName || 'ServerAvatar Customer'
  const eligible = (transactions || []).filter(isChargeableInvoice)
  if (eligible.length === 0) return null

  const details = (orgId && getBillingDetails(orgId)) || {}
  const defaultCard = (orgId && getDefaultCard(orgId)) || null
  const cardLine = defaultCard
    ? `${esc(defaultCard.brand || 'Card')} •••• ${esc(defaultCard.last4 || '0000')}`
    : 'No payment method on file'

  const total = eligible.reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const sorted = [...eligible].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  const oldest = sorted[sorted.length - 1]?.createdAt
  const newest = sorted[0]?.createdAt

  // Cover sheet
  const coverRows = sorted
    .map((t) => {
      const invoiceNo = `INV-${String(t.id || '00000').padStart(5, '0')}`
      return `<tr>
        <td style="font-variant-numeric: tabular-nums;">${esc(fmtDateShort(t.createdAt))}</td>
        <td>${esc(t.description || 'Plan charge')}</td>
        <td style="text-align: right; font-variant-numeric: tabular-nums;">${fmtMoney(t.amount)}</td>
      </tr>`
    })
    .join('')

  // Each invoice — wrap the body of the single-invoice template in a
  // page-break div. We extract the body content from buildInvoiceHtml
  // (everything between <body> and </body>) and append our own page break.
  const invoicePages = sorted
    .map((t, idx) => {
      const full = buildInvoiceHtml(t, { orgId, orgName })
      if (!full) return ''
      // Extract the <body>...</body> contents and wrap in a page div.
      const bodyMatch = full.match(/<body>([\s\S]*)<\/body>/)
      const inner = bodyMatch ? bodyMatch[1] : full
      return `<div class="page"><div class="page-content">${inner}</div></div>${idx < sorted.length - 1 ? '<div class="page-break"></div>' : ''}`
    })
    .join('')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Bulk invoice export — ${esc(orgName)}</title>
  <style>
    @page { size: A4; margin: 0.6in; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }
    .page-break { page-break-after: always; break-after: page; height: 0; }
    .page { page-break-after: always; break-after: page; padding: 0; width: 100%; max-width: 100%; overflow-x: hidden; }
    .page:last-child { page-break-after: auto; break-after: auto; }
    /* The bulk export renders both the cover sheet and individual invoice
       pages. Each gets its own printable area (matching @page margins). */
    .page-content { padding: 0.6in; min-width: 0; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 28px; min-width: 0; }
    .issuer { font-size: 18px; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; min-width: 0; flex: 1 1 auto; word-break: break-word; overflow-wrap: anywhere; }
    .issuer-sub { font-size: 11px; color: #64748b; margin-top: 4px; word-break: break-word; overflow-wrap: anywhere; }
    .meta { text-align: right; min-width: 0; flex: 0 1 auto; max-width: 55%; overflow-wrap: anywhere; word-break: break-word; }
    .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
    .meta-value { font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 2px; overflow-wrap: anywhere; word-break: break-word; }
    .meta-status { display: inline-block; padding: 2px 8px; border-radius: 9999px; background: #dcfce7; color: #166534; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 6px; max-width: 100%; overflow-wrap: anywhere; word-break: break-word; }
    .meta-status-failed { background: #fee2e2; color: #991b1b; }
    .meta-status-refunded { background: #fef3c7; color: #92400e; }

    /* Cover sheet styles */
    .cover-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; gap: 24px; min-width: 0; }
    .cover-title { font-size: 22px; font-weight: 700; letter-spacing: -0.01em; min-width: 0; flex: 1 1 auto; word-break: break-word; overflow-wrap: anywhere; }
    .cover-sub { font-size: 11px; color: #64748b; margin-top: 4px; min-width: 0; word-break: break-word; overflow-wrap: anywhere; }
    .cover-meta { text-align: right; font-size: 11px; color: #475569; min-width: 0; flex: 0 1 auto; max-width: 55%; overflow-wrap: anywhere; word-break: break-word; }
    .cover-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 24px 0; }
    .cover-stat { padding: 14px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; }
    .cover-stat .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
    .cover-stat .value { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 4px; font-variant-numeric: tabular-nums; }
    .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin: 24px 0 8px; }
    table.list { width: 100%; border-collapse: collapse; table-layout: fixed; }
    table.list th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; font-weight: 600; padding: 8px 0; border-bottom: 1px solid #e2e8f0; overflow-wrap: anywhere; word-break: break-word; }
    table.list td { padding: 10px 0; font-size: 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; }
    .bill-to { font-size: 12px; color: #1e293b; line-height: 1.6; }
    .bill-to .name { font-weight: 600; color: #0f172a; }
    .pay { margin-top: 24px; padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 11px; color: #475569; }
    .pay .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
    .pay .value { font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 2px; }
    .footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; gap: 16px; min-width: 0; }
    .footer > span { min-width: 0; overflow-wrap: anywhere; word-break: break-word; }

    /* Per-invoice page styles (extracted from buildInvoiceHtml body) */
    .section { margin-bottom: 22px; }
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
    .pay .value { font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 2px; overflow-wrap: anywhere; word-break: break-word; }
  </style>
</head>
<body>
  <div class="page">
    <div class="page-content">
      <div class="cover-header">
      <div>
        <div class="cover-title">Invoice export</div>
        <div class="cover-sub">${esc(orgName)} · ServerAvatar Central Panel</div>
      </div>
      <div class="cover-meta">
        <div>Generated ${esc(fmtDateShort(new Date().toISOString()))}</div>
        <div style="margin-top: 4px;">${sorted.length} invoice${sorted.length === 1 ? '' : 's'}</div>
      </div>
    </div>

    <div class="cover-stats">
      <div class="cover-stat">
        <div class="label">Total invoices</div>
        <div class="value">${sorted.length}</div>
      </div>
      <div class="cover-stat">
        <div class="label">Total amount</div>
        <div class="value">${fmtMoney(total)}</div>
      </div>
      <div class="cover-stat">
        <div class="label">Date range</div>
        <div class="value" style="font-size: 12px; line-height: 1.4; padding-top: 4px;">${esc(fmtDateShort(oldest))}<br/>→ ${esc(fmtDateShort(newest))}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Bill to</div>
      <div class="bill-to">
        ${details.name ? `<div class="name">${esc(details.name)}</div>` : ''}
        ${details.company ? `<div>${esc(details.company)}</div>` : ''}
        ${details.email ? `<div>${esc(details.email)}</div>` : ''}
        ${details.country ? `<div>${esc(details.country)}</div>` : ''}
      </div>
    </div>

    <div class="section-title">Included invoices</div>
    <table class="list">
      <thead>
        <tr>
          <th style="width: 22%;">Date</th>
          <th>Description</th>
          <th style="text-align: right; width: 18%;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${coverRows}
      </tbody>
    </table>

    <div class="pay">
      <div class="label">Payment method</div>
      <div class="value">${cardLine}</div>
    </div>

    <div class="footer">
      <span>ServerAvatar Central Panel · Bulk export</span>
      <span>${sorted.length} invoice${sorted.length === 1 ? '' : 's'} · ${fmtMoney(total)}</span>
    </div>
    </div>
  </div>

  <div class="page-break"></div>

  ${invoicePages}
</body>
</html>`
}
