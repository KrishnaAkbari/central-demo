'use client'

import { useState, useRef } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { buildInvoiceHtml, isChargeableInvoice } from '@/services/invoicePdf'

// InvoicePdfButton — per-row "Download PDF" action.
//
// Hidden-iframe approach (zero new deps):
//   1. Create an off-screen iframe.
//   2. Write the printable HTML into it.
//   3. Call iframe.contentWindow.print() to open the native print dialog
//      where the user picks "Save as PDF" as the destination.
//
// Why an iframe and not window.open? window.open can be blocked by popup
// blockers and also detaches from the parent context. The iframe approach
// is allowed because it runs in the same page context, started by a user
// gesture (click), and is the same pattern Stripe's hosted invoice page
// used before they switched to actual PDF generation servers.
//
// Disabled state: rendered as a non-interactive Button with a tooltip
// when the transaction is not a chargeable invoice (refund, credit,
// zero-amount trial).
export function InvoicePdfButton({ tx, orgName, orgId, size = 'icon' }) {
  const [loading, setLoading] = useState(false)
  const iframeRef = useRef(null)
  const eligible = isChargeableInvoice(tx)

  const handleClick = () => {
    if (!eligible) return
    const html = buildInvoiceHtml(tx, { orgId, orgName })
    if (!html) return
    setLoading(true)
    try {
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      iframe.setAttribute('aria-hidden', 'true')
      iframe.setAttribute('data-testid', `invoice-pdf-iframe-${tx.id}`)
      document.body.appendChild(iframe)
      iframeRef.current = iframe
      // Wait for the iframe to fully load (about:blank) before writing
      // content. Writing into an iframe that's still parsing the src
      // about:blank can silently fail and the load event never fires.
      const triggerPrint = () => {
        const doc = iframe.contentDocument || iframe.contentWindow?.document
        if (!doc) {
          console.warn('[invoice-pdf] no document on iframe, bailing')
          setLoading(false)
          try { iframe.remove() } catch {}
          return
        }
        doc.open()
        doc.write(html)
        doc.close()
        // Give the document a tick to parse before invoking print.
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus()
            iframe.contentWindow?.print()
          } catch (err) {
            console.warn('[invoice-pdf] print failed:', err)
          } finally {
            setTimeout(() => {
              try { iframe.remove() } catch {}
              setLoading(false)
              iframeRef.current = null
            }, 1500)
          }
        }, 100)
      }
      if (iframe.contentDocument?.readyState === 'complete') {
        triggerPrint()
      } else {
        iframe.addEventListener('load', triggerPrint, { once: true })
      }
    } catch (err) {
      console.error('[invoice-pdf] generation failed:', err)
      setLoading(false)
    }
  }

  if (!eligible) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              type="button"
              variant="ghost"
              size={size}
              disabled
              aria-label="Not a chargeable invoice"
              data-testid={`invoice-pdf-button-${tx.id}`}
              data-eligible="false"
            >
              <FileText className="h-4 w-4 opacity-40" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Not a chargeable invoice
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={size}
          onClick={handleClick}
          disabled={loading}
          aria-label="Download invoice PDF"
          data-testid={`invoice-pdf-button-${tx.id}`}
          data-eligible="true"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Download invoice PDF
      </TooltipContent>
    </Tooltip>
  )
}
