import { redirect } from 'next/navigation'

// /billing index — redirect to the main landing page (Overview). The
// Overview page is the canonical "where am I, what should I do next?"
// view, so it's the right entry point for owners, members (who'll see a
// restricted-access card), and trial users alike.
export default function BillingIndex() {
  redirect('/billing/overview')
}