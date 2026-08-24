import { redirect } from 'next/navigation'

/**
 * /servers/add — kept as a redirect so old links, bookmarks, and the
 * Cmd+K palette's prior entry don't 404. The chooser page now lives at
 * /servers/add/create (step 1 of the wizard).
 */
export default function AddServerChooserPage() {
  redirect('/servers/add/create')
}