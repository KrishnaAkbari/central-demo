'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  User,
  Building2,
  Mail,
  MapPin,
  Hash,
  Save,
  CheckCircle2,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FieldRow } from '@/components/ui/field'
import { PersonaSwitcher } from '@/components/billing/PersonaSwitcher'
import { RestrictedAccess } from '@/components/billing/RestrictedAccess'
import {
  COUNTRIES,
  TAX_ID_REQUIRED_COUNTRIES,
  isValidEmail,
} from '@/components/billing/countries'
import {
  getActiveOrgId,
  getBillingDetails,
  saveBillingDetails,
} from '@/services/billingApi'
import { useIsOwner } from '@/stores/organizationStore'
import { toast } from 'sonner'

// Field state shape — strings, all controlled.
const EMPTY_FORM = {
  name: '',
  company: '',
  email: '',
  address: '',
  country: '',
  taxId: '',
}

// Max character caps — soft limits that match typical invoice formats.
const LIMITS = {
  name: 80,
  company: 100,
  email: 120,
  address: 200,
  taxId: 30,
}

export default function BillingBillingDetailsPage() {
  const isOwner = useIsOwner()
  const [refreshKey, setRefreshKey] = useState(0)
  const [saved, setSaved] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [pending, setPending] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [countryOpen, setCountryOpen] = useState(false)
  const [orgId, setOrgId] = useState(null)

  useEffect(() => {
    if (!isOwner) return
    const id = getActiveOrgId()
    setOrgId(id)
    if (!id) return
    const d = getBillingDetails(id) || EMPTY_FORM
    setSaved(d)
    setForm({
      name: d.name || '',
      company: d.company || '',
      email: d.email || '',
      address: d.address || '',
      country: d.country || '',
      taxId: d.taxId || '',
    })
    setDirty(false)
    setErrors({})
  }, [refreshKey, isOwner])

  // Derived: is the form valid overall?
  const computed = useMemo(() => {
    const requiredFields = ['name', 'email', 'address', 'country']
    const missing = requiredFields.filter(
      (k) => !form[k] || form[k].trim() === '',
    )
    const emailBad = form.email && !isValidEmail(form.email)
    const taxIdMissing =
      TAX_ID_REQUIRED_COUNTRIES.has(countryCode(form.country)) &&
      !form.taxId.trim()
    return {
      missing,
      emailBad,
      taxIdMissing,
      valid:
        missing.length === 0 &&
        !emailBad &&
        !taxIdMissing,
    }
  }, [form])

  // Non-owner early return AFTER all hooks.
  if (!isOwner) return <RestrictedAccess />

  if (!saved) {
    return (
      <PageContainer>
        <PageHeader title="Billing Profile" description="Loading…" />
      </PageContainer>
    )
  }

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setDirty(true)
    // Clear that field's error live as the user fixes it.
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  // Validate everything before allowing Save. Returns parsed errors map.
  const validate = () => {
    const next = {}
    if (!form.name.trim()) next.name = 'Required'
    if (!form.email.trim()) next.email = 'Required'
    else if (!isValidEmail(form.email)) next.email = 'Enter a valid email'
    if (!form.address.trim()) next.address = 'Required'
    if (!form.country.trim()) next.country = 'Required'
    if (
      TAX_ID_REQUIRED_COUNTRIES.has(countryCode(form.country)) &&
      !form.taxId.trim()
    ) {
      next.taxId = `Tax ID is required for ${form.country}`
    }
    return next
  }

  const handleSave = async (e) => {
    e?.preventDefault?.()
    if (pending) return
    const nextErrors = validate()
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      toast.error('Please fix the highlighted fields before saving.')
      return
    }
    setPending(true)
    // Mock latency for the optimistic-style save button.
    await new Promise((r) => setTimeout(r, 500))
    if (!orgId) return
    saveBillingDetails(orgId, {
      name: form.name.trim(),
      company: form.company.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      country: form.country,
      taxId: form.taxId.trim(),
    })
    setPending(false)
    setDirty(false)
    setRefreshKey((k) => k + 1)
    toast.success('Billing details saved.')
  }

  const handleReset = () => {
    setForm({
      name: saved.name || '',
      company: saved.company || '',
      email: saved.email || '',
      address: saved.address || '',
      country: saved.country || '',
      taxId: saved.taxId || '',
    })
    setErrors({})
    setDirty(false)
  }

  const handleClear = () => {
    setForm(EMPTY_FORM)
    setErrors({})
    setDirty(true)
  }

  const taxIdHint = TAX_ID_REQUIRED_COUNTRIES.has(countryCode(form.country))
    ? 'Required for invoicing in this country.'
    : 'Optional unless your country requires one for invoicing.'

  return (
    <PageContainer>
      <PageHeader
        title="Billing Profile"
        description="Contact information we print on every invoice and email to you. Visible only to the org owner."
      >
        <PersonaSwitcher />
      </PageHeader>

      <div className="space-y-6">
        {/* Status / saved banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            {saved.savedAt ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-slate-700 dark:text-slate-300">
                  Last saved{' '}
                  <span className="font-medium text-slate-900 dark:text-white">
                    {formatSavedAt(saved.savedAt)}
                  </span>
                </span>
              </>
            ) : (
              <>
                <Pencil className="h-4 w-4 text-slate-400" />
                <span className="text-slate-500 dark:text-slate-400">
                  Not yet saved. We use a placeholder on invoices until you fill this in.
                </span>
              </>
            )}
            {dirty && (
              <span className="ml-2 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 dark:bg-amber-500/15 dark:border-amber-500/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={pending || !dirty}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={pending}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Contact */}
          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <User className="h-4 w-4 text-slate-500" />
              Contact
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Who the bill is for. We email invoices to this address.
            </p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <FieldRow
                label="Billing name"
                htmlFor="name"
                required
                error={errors.name}
                helper="Person or business the invoice is addressed to."
              >
                <Input
                  id="name"
                  value={form.name}
                  maxLength={LIMITS.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="Jane Doe"
                />
              </FieldRow>
              <FieldRow
                label="Company"
                htmlFor="company"
                optional
                error={errors.company}
                helper="Appears below the billing name on the invoice."
              >
                <Input
                  id="company"
                  value={form.company}
                  maxLength={LIMITS.company}
                  onChange={(e) => setField('company', e.target.value)}
                  placeholder="Acme Hosting Ltd"
                />
              </FieldRow>
              <FieldRow
                label="Billing email"
                htmlFor="email"
                required
                error={errors.email}
                helper="We send invoice PDFs here."
                className="sm:col-span-2"
              >
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    maxLength={LIMITS.email}
                    onChange={(e) => setField('email', e.target.value)}
                    placeholder="billing@example.com"
                    className="pl-8"
                  />
                </div>
              </FieldRow>
            </div>
          </Card>

          {/* Address */}
          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <MapPin className="h-4 w-4 text-slate-500" />
              Address
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Required for tax compliance. Shown on every invoice.
            </p>
            <div className="mt-5 grid gap-5 sm:grid-cols-6">
              <FieldRow
                label="Street address"
                htmlFor="address"
                required
                error={errors.address}
                helper="Number, street, apartment, suite, etc."
                className="sm:col-span-6"
              >
                <Input
                  id="address"
                  value={form.address}
                  maxLength={LIMITS.address}
                  onChange={(e) => setField('address', e.target.value)}
                  placeholder="123 Main Street, Apt 4B"
                />
              </FieldRow>
              <FieldRow
                label="Country"
                htmlFor="country"
                required
                error={errors.country}
                helper="Used to determine tax treatment for invoices."
                className="sm:col-span-3"
              >
                <Select
                  value={form.country}
                  onValueChange={(val) => {
                    setField('country', val)
                    setCountryOpen(false)
                  }}
                  open={countryOpen}
                  onOpenChange={setCountryOpen}
                >
                  <SelectTrigger id="country" className="w-full">
                    <SelectValue placeholder="Select a country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow
                label="Tax ID"
                htmlFor="taxId"
                optional={!TAX_ID_REQUIRED_COUNTRIES.has(countryCode(form.country))}
                required={TAX_ID_REQUIRED_COUNTRIES.has(countryCode(form.country))}
                error={errors.taxId}
                helper={taxIdHint}
                className="sm:col-span-3"
              >
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    id="taxId"
                    value={form.taxId}
                    maxLength={LIMITS.taxId}
                    onChange={(e) => setField('taxId', e.target.value)}
                    placeholder={taxIdPlaceholder(form.country)}
                    className="pl-8"
                  />
                </div>
              </FieldRow>
            </div>
          </Card>

          {/* Save row */}
          <Card className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/60 dark:bg-slate-800/30">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Building2 className="h-3.5 w-3.5" />
              {computed.valid
                ? 'All required fields are filled in.'
                : `${computed.missing.length + (computed.emailBad ? 1 : 0) + (computed.taxIdMissing ? 1 : 0)} fields need attention before saving.`}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={pending || !dirty}
              >
                Discard changes
              </Button>
              <Button type="submit" disabled={pending || !dirty}>
                <Save className="h-4 w-4" />
                {pending ? 'Saving…' : 'Save billing details'}
              </Button>
            </div>
          </Card>
        </form>

        {/* Preview — what the saved invoice currently says */}
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Invoice preview
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Exactly what shows up in the PDF header for the currently saved details.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 font-mono text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            <div className="font-semibold not-italic text-slate-900 dark:text-white text-sm font-sans mb-2">
              Bill to
            </div>
            <div className="italic">{saved.name || '(name)'}</div>
            {saved.company && <div className="italic">{saved.company}</div>}
            <div className="italic">{saved.address || '(address)'}</div>
            {saved.country && <div className="italic">{saved.country}</div>}
            <div className="italic">{saved.email || '(email)'}</div>
            {saved.taxId && (
              <div className="mt-2 text-2xs text-slate-500 dark:text-slate-400 not-italic">
                Tax ID: {saved.taxId}
              </div>
            )}
          </div>
        </Card>
      </div>
    </PageContainer>
  )
}

function countryCode(displayName) {
  const c = COUNTRIES.find((c) => c.name === displayName)
  return c ? c.code : ''
}

function taxIdPlaceholder(displayName) {
  const code = countryCode(displayName)
  if (!code) return 'EU VAT, GST, ABN, etc.'
  const placeholders = {
    US: 'EIN (XX-XXXXXXX)',
    GB: 'VAT: GB123456789',
    DE: 'VAT: DE123456789',
    FR: 'VAT: FR12345678901',
    AU: 'ABN: 12 345 678 901',
    IN: 'GSTIN: 22AAAAA0000A1Z5',
    CA: 'GST/HST: 123456789RT0001',
    JP: '適格請求書番号: T1234567890123',
  }
  return placeholders[code] || 'Tax ID'
}

function formatSavedAt(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
