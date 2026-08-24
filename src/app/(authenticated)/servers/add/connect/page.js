import { redirect } from 'next/navigation'

/**
 * /servers/add/connect — legacy standalone connect-by-key route.
 *
 * The connect-existing flow now lives inside the create wizard at
 * /servers/add/create. We redirect here so old links and bookmarks
 * still land the user on the right flow. The wizard reads the
 * ?source= param and pre-selects the connect-existing branch.
 */
export default function LegacyConnectPage() {
  redirect('/servers/add/create?source=connect_existing')
}
