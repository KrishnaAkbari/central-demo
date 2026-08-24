'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  KeyRound, ShieldAlert, CheckCircle2,
  Plus, Server as ServerIcon, ChevronDown, Info, AlertOctagon, ListChecks,
  ShieldCheck, Globe, Cpu, X as XIcon,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldRow } from '@/components/ui/field'
import { showToast } from '@/utils/toast-utils'

import * as api from '@/services/centralApi'

const KEY_HINT_REGEX = /^sm_[a-f0-9]{16,}$/

/**
 * ConnectExistingStep — connect a server that already runs ServerAvatar.
 *
 * Single flat form, all in one card. Two inputs visible from the start:
 *   - Server Management Key
 *   - Server name in Central Panel
 *
 * The key field auto-verifies after a valid paste (debounced 800ms), so
 * most of the time the user just pastes a key, sees the "Verified"
 * chip appear, types a name, and clicks Connect — no manual verify
 * click. The Verify button stays as a fallback for manual re-verify.
 * The name field is enabled once the key is verified.
 *
 * On success the page navigates straight to /servers/[id] — there is
 * no intermediate "Connected!" screen. On failure the error stays
 * inline below the fields, and the user can fix the key and retry
 * without losing their typed name.
 */
export function ConnectExistingStep() {
  const router = useRouter()

  const [key, setKey] = useState('')
  const [name, setName] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)

  const cleanKey = key.trim()
  const keyValid = KEY_HINT_REGEX.test(cleanKey)
  const canVerify = keyValid && !verifying
  const canConnect = !!preview && name.trim().length > 0 && !connecting

  const handleVerify = async () => {
    if (!canVerify) return
    setVerifying(true)
    setError(null)
    try {
      const result = await api.verifyServerByKey(cleanKey)
      setPreview({ ...result, key: cleanKey })
      if (!name.trim()) setName(result.hostname || '')
    } catch (err) {
      setError(err?.message || 'Could not verify key')
      setPreview(null)
    } finally {
      setVerifying(false)
    }
  }

  // Keep a ref to the latest handleVerify so the auto-verify effect can
  // call it without re-running every time handleVerify is recreated.
  const handleVerifyRef = useRef(handleVerify)
  useEffect(() => {
    handleVerifyRef.current = handleVerify
  }, [handleVerify])

  // Auto-verify after a valid key is typed or pasted. Debounced 800ms so
  // character-by-character typing doesn't trigger a verify per keystroke.
  // The Verify button is still available for manual re-verify.
  useEffect(() => {
    // Don't auto-verify if: key doesn't match regex yet, already verifying,
    // already verified (preview exists), an error is showing (let user fix
    // manually first), or we're in the post-verify connect flow.
    if (!keyValid || verifying || preview || error || connecting) return
    const timer = setTimeout(() => {
      handleVerifyRef.current()
    }, 800)
    return () => clearTimeout(timer)
  }, [cleanKey, keyValid, verifying, preview, error, connecting])

  const handleClearVerification = () => {
    setPreview(null)
    setError(null)
  }

  const handleConnect = async () => {
    if (!canConnect) return
    setConnecting(true)
    setError(null)
    try {
      const connected = await api.connectServerByKey(preview.key, {
        label: name.trim() || preview.hostname,
      })
      showToast.success('Server connected')
      router.push(`/servers/${connected.id}`)
    } catch (err) {
      setError(err?.message || 'Failed to connect server')
      setConnecting(false)
    }
  }

  return (
    <div className="space-y-6" data-testid="connect-existing-step">
      {/* Hero — explains what the user is doing. */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 via-white to-white dark:from-slate-800/60 dark:via-slate-900 dark:to-slate-900 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Connect a server via Open Source Panel
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-snug">
              Paste the Server Management Key from a server that already runs
              ServerAvatar Open Source Panel. Central Panel verifies the key,
              then links the server for monitoring and management — no install
              or SSH required.
            </p>
          </div>
        </div>
      </div>

      {/* Single card: both inputs + verify + connect. The verified state
          shows as a small inline chip next to the key field, not as a
          separate large card. */}
      <Card className="p-6 space-y-5">
        {/* Key field with inline verified chip */}
        <div>
          <FieldRow
            label="Server Management Key"
            htmlFor="cx-key"
            helper="Starts with sm_ followed by 16 or more hex characters. Get it from Open Source Panel → Admin → Server Management Key."
          >
            <Input
              id="cx-key"
              value={key}
              onChange={(e) => {
                setKey(e.target.value)
                if (preview) handleClearVerification()
                if (error) setError(null)
              }}
              placeholder="sm_xxxxxxxxxxxxxxxxxxxxxxxx"
              autoComplete="off"
              spellCheck={false}
              className={
                'h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-500 px-3 font-mono text-xs ' +
                (preview ? 'border-emerald-400 dark:border-emerald-500/50' : '')
              }
            />
          </FieldRow>

          {preview ? (
            <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-200/70 dark:border-emerald-500/30">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Verified</span>
                <span className="text-emerald-800/70 dark:text-emerald-300/70">·</span>
                <span className="font-mono">{preview.hostname}</span>
                <span className="text-emerald-800/70 dark:text-emerald-300/70">·</span>
                <span className="font-mono">{preview.ip}</span>
              </div>
              <button
                type="button"
                onClick={handleClearVerification}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white dark:hover:text-white transition-colors"
                title="Clear verification and edit the key"
              >
                <XIcon className="h-3.5 w-3.5" />
                Edit key
              </button>
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>Keep this key private. It can be rotated any time from Open Source Panel.</span>
              </div>
              <Button
                type="button"
                size="default"
                onClick={handleVerify}
                disabled={!canVerify}
                loading={verifying}
                className="gap-2 rounded-lg"
                data-testid="cx-verify"
              >
                <KeyRound className="h-3.5 w-3.5" />
                {verifying ? 'Verifying…' : 'Verify key'}
              </Button>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800" />

        {/* Name field — always visible, disabled until verified. */}
        <FieldRow
          label="Server name in Central Panel"
          htmlFor="cx-name"
          helper={
            preview
              ? 'Defaults to the verified hostname. Change it any time after connection.'
              : 'Defaults to the verified hostname once you verify the key above.'
          }
        >
          <Input
            id="cx-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!preview}
            placeholder={preview ? preview.hostname : 'Verify a key to enable this field'}
            className="h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-500 px-3 disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </FieldRow>

        {/* Error inline, near the action button */}
        {error && <VerifyError error={error} />}

        {/* Single primary action at the bottom. */}
        <div className="flex justify-end pt-1">
          <Button
            type="button"
            
            onClick={handleConnect}
            disabled={!canConnect}
            loading={connecting}
            className="gap-2"
            data-testid="cx-connect"
          >
            Connect server
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <KeyFaq />
    </div>
  )
}

function VerifyError({ error }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 p-4 text-sm">
      <div className="flex items-start gap-2.5">
        <AlertOctagon className="h-4 w-4 mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-red-800 dark:text-red-200">Could not connect to server</p>
          <p className="text-xs text-red-700 dark:text-red-300/80 mt-0.5 leading-snug">
            {error}
          </p>
          <div className="mt-3 rounded-lg bg-white/70 dark:bg-slate-900/30 border border-red-200/70 dark:border-red-500/20 px-3 py-3">
            <div className="flex items-center gap-1.5 mb-2">
              <ListChecks className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
              <p className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-300">
                Likely causes — verify each
              </p>
            </div>
            <ul className="space-y-1.5 text-xs text-red-800 dark:text-red-300/90">
              <Cause icon={KeyRound} text="Key — copy the full token, including the sm_ prefix" />
              <Cause icon={ShieldCheck} text="Key validity — revoked or rotated keys return this error" />
              <Cause icon={ServerIcon} text="Server reachable — the Open Source Panel must be reachable by Central Panel" />
              <Cause icon={Globe} text="Network — outbound HTTPS from the server to Central Panel must be allowed" />
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function Cause({ icon: Icon, text }) {
  return (
    <li className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span className="leading-snug">{text}</span>
    </li>
  )
}

function KeyFaq() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:hover:bg-slate-800/40 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <Info className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
          <span className="text-sm font-medium text-slate-900 dark:text-white">
            What is a Server Management Key?
          </span>
        </div>
        <ChevronDown
          className={
            'h-4 w-4 text-slate-500 dark:text-slate-400 transition-transform ' + (open ? 'rotate-180' : '')
          }
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 text-sm text-slate-600 dark:text-slate-300 border-t border-slate-200 dark:border-slate-800">
          <p>
            A Server Management Key is a secret token your ServerAvatar Open
            Source Panel generates per server. Each key grants Central Panel
            exactly the access it needs to read server stats and run management
            actions — nothing more.
          </p>
          <p>
            Generate one in Open Source Panel under{' '}
            <span className="font-mono text-xs">Admin Panel &rarr; Server Management Key</span>,
            paste it here, and Central Panel verifies the server before linking
            the two sides. You can rotate or revoke the key at any time.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            The full key is shown only at creation. Central Panel keeps the last
            4 characters for display and discards the rest.
          </p>
        </div>
      )}
    </div>
  )
}
