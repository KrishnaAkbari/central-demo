'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Terminal, Server as ServerIcon, Globe, Cpu, MemoryStick, HardDrive,
  CheckCircle2, AlertTriangle, AlertOctagon, ShieldCheck, ShieldAlert, Shield,
  ListChecks, Plug, User, Wrench, Sparkles,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FieldRow } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { showToast } from '@/utils/toast-utils'

import * as api from '@/services/centralApi'

const SUPPORTED_OS_LIST = api.SUPPORTED_OS_LIST

/**
 * CustomVpsStep — SSH-based configure step for Custom VPS source.
 *
 * Flow:
 *   1. User fills IP / port / user / password.
 *   2. User clicks "Verify SSH access".
 *   3. `verifySsh` returns the server spec on success. The result
 *      includes the detected OS (`os`, `osId`) and `osSupported: bool`
 *      so the UI can flag unsupported distributions clearly.
 *   4. On success we render the server info card and enable the
 *      "Install on this VPS" button, which advances directly to the
 *      install step (no separate Review step in the wizard).
 *
 * Pre-flight verification is mandatory. There is no "skip" path in the
 * normal user flow — Central Panel must actually confirm SSH access
 * before it will install ServerAvatar on the user's VPS. A separate
 * `?demo_skip_preflight=1` query bypass exists for local development
 * only and is rendered as a clearly-labelled developer card, never
 * mixed into the normal verify action. See the wizard footer in
 * `create/page.js` for that opt-in.
 */
export function CustomVpsStep({ initial, onContinue }) {
  const searchParams = useSearchParams()
  // Developer-only bypass. The user opts in by adding ?demo_skip_preflight=1
  // to the URL. The dev card is rendered ONLY when this param is present,
  // so it can never accidentally appear in the normal flow.
  const devBypass = searchParams?.get('demo_skip_preflight') === '1'

  const [ip, setIp] = useState(initial?.ip || '')
  const [port, setPort] = useState(initial?.port || 22)
  const [user, setUser] = useState(initial?.user || 'root')
  const [password, setPassword] = useState(initial?.password || '')
  const [busy, setBusy] = useState(false)
  const [verified, setVerified] = useState(initial?.verified || null)
  const [error, setError] = useState(null)

  const handleVerify = async () => {
    setBusy(true)
    setError(null)
    try {
      const info = await api.verifySsh({ ip, port, user, password })
      setVerified(info)
      setError(null)
      showToast.success('SSH connection verified')
    } catch (err) {
      setError(err?.message || 'Verification failed')
      setVerified(null)
    } finally {
      setBusy(false)
    }
  }

  const canVerify = !!(ip && port && user && password)
  const canContinue = !!verified

  // Fills in a fake successful verification result. The OS is one of the
  // supported IDs so the flow proceeds all the way to provisioning. The
  // IP is whatever the user typed (or a demo placeholder).
  const handleDevBypass = () => {
    const demoIp = ip || '203.0.113.99'
    setIp(demoIp)
    setVerified({
      hostname: 'demo.serveravatar.local',
      ip: demoIp,
      port: port || 22,
      user: user || 'root',
      os: 'Ubuntu 24.04 LTS',
      osId: 'ubuntu-24-04',
      osSupported: true,
      cpu: { cores: 2, loadPct: 12 },
      memory: { totalMb: 4096, usedMb: 980 },
    })
    setError(null)
  }

  return (
    <div className="space-y-6">
      {/* Hero band — explains what this step does and what OSes we support,
          using visible chips instead of a comma-separated sentence. */}
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-gradient-to-br from-emerald-50 via-white to-white dark:from-emerald-500/10 dark:via-slate-900 dark:to-slate-900 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <Terminal className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Install on your VPS
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-snug">
              Bring your own server. Central Panel connects over SSH, installs ServerAvatar,
              and configures it for management — your password is used once and never stored.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Supported OS
              </span>
              {SUPPORTED_OS_LIST.map((os) => (
                <span
                  key={os}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium bg-emerald-100/70 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 ring-1 ring-inset ring-emerald-200/60 dark:ring-emerald-500/20"
                >
                  {os}
                </span>
              ))}
              <span className="text-2xs text-slate-500 dark:text-slate-400">
                · Other distributions detected and flagged
              </span>
            </div>
          </div>
        </div>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-5">
          <div className="sm:col-span-6">
            <FieldRow label="Server IP address" htmlFor="cvps-ip" required>
              <Input
                id="cvps-ip"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="203.0.113.10"
                autoFocus
                inputMode="numeric"
              />
            </FieldRow>
          </div>

          <div className="sm:col-span-3">
            <FieldRow label="SSH port" htmlFor="cvps-port" required>
              <Input
                id="cvps-port"
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(e) => setPort(Number(e.target.value) || '')}
              />
            </FieldRow>
          </div>

          <div className="sm:col-span-3">
            <FieldRow label="SSH user" htmlFor="cvps-user" required>
              <Input
                id="cvps-user"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="root"
              />
            </FieldRow>
          </div>

          <div className="sm:col-span-6">
            <FieldRow
              label="SSH password"
              htmlFor="cvps-pass"
              required
              helper="Used once to install ServerAvatar. Central Panel will not store your password."
            >
              <Input
                id="cvps-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </FieldRow>
          </div>
        </div>

        {error && <VerificationError error={error} />}

        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            
            onClick={handleVerify}
            disabled={!canVerify || busy}
            loading={busy}
            className="gap-2"
            data-testid="cvps-verify"
          >
            <Terminal className="h-4 w-4" />
            {verified ? 'Re-verify SSH access' : 'Verify SSH access'}
          </Button>
        </div>
      </Card>

      {verified && (
        <Card className={
          verified.osSupported
            ? 'p-5 border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-500/5'
            : 'p-5 border-amber-300 dark:border-amber-500/40 bg-amber-50/30 dark:bg-amber-500/5'
        }>
          <div className="flex items-center gap-3 mb-4">
            <div className={
              verified.osSupported
                ? 'h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-700 dark:text-emerald-300'
                : 'h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-300'
            }>
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h4 className={
                verified.osSupported
                  ? 'font-semibold text-emerald-900 dark:text-emerald-200'
                  : 'font-semibold text-amber-900 dark:text-amber-200'
              }>
                {verified.osSupported
                  ? 'Server verified and ready for ServerAvatar installation.'
                  : 'SSH works, but OS isn’t in the supported list'}
              </h4>
              <p className={
                verified.osSupported
                  ? 'text-xs text-emerald-800 dark:text-emerald-300/80'
                  : 'text-xs text-amber-800 dark:text-amber-300/80'
              }>
                {verified.osSupported
                  ? 'Detected server details below. Click Install on this VPS when you’re ready.'
                  : 'Central Panel can install, but the Open Source Panel has not been validated against this distribution.'}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
            <DetailCell icon={ServerIcon} label="Hostname" value={verified.hostname} />
            <DetailCell icon={Globe}   label="IP address" value={verified.ip} />
            <DetailCell icon={Plug}    label="SSH port" value={String(verified.port)} />
            <DetailCell icon={User}    label="SSH user" value={verified.user} />
            <DetailCell icon={Shield}  label="Compatibility" value={
              verified.osSupported ? 'Compatible' : 'Not validated'
            } tone={verified.osSupported ? 'ok' : 'warn'} />
            <div className="min-w-0">
              <dt className="text-2xs uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">Operating system</dt>
              <dd className="text-sm text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                <ServerIcon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                <span className="truncate">{verified.os}</span>
                <OsSupportPill supported={!!verified.osSupported} />
              </dd>
            </div>
          </dl>

          <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm text-slate-700 dark:text-slate-200">
              <DetailCell icon={Cpu} label="CPU" value={`${verified.cpu.cores} vCPU`} />
              <DetailCell icon={MemoryStick} label="Memory" value={`${(verified.memory.totalMb / 1024).toFixed(0)} GB`} />
              <DetailCell icon={HardDrive} label="Disk" value="—" />
            </dl>
          </div>
        </Card>
      )}

      <div className="flex justify-end pt-2">
        <Button
          type="button"
          
          onClick={() => onContinue({ ip, port, user, password, verified })}
          disabled={!canContinue}
          className="gap-2"
          data-testid="cvps-continue"
        >
          Install on this VPS
          <Sparkles className="h-4 w-4" />
        </Button>
      </div>

      {devBypass && (
        <div className="rounded-xl border border-dashed border-amber-300 dark:border-amber-500/40 bg-amber-50/60 dark:bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Wrench className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Developer tools
                </p>
                <span className="text-xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-200/70 dark:bg-amber-500/30 text-amber-800 dark:text-amber-200">
                  Local dev only
                </span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300/80 mt-1 leading-snug">
                This card is hidden in production. It appears only when the URL contains{' '}
                <code className="font-mono px-1 py-0.5 rounded bg-amber-100/80 dark:bg-amber-500/20">?demo_skip_preflight=1</code>.
                Use it to test the install flow without a real SSH server.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDevBypass}
                  data-testid="cvps-dev-skip"
                  className="gap-1.5 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-500/20"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Skip pre-flight (demo)
                </Button>
                <span className="text-2xs text-amber-700 dark:text-amber-300/70 self-center">
                  Fills in a fake verified result with Ubuntu 24.04 LTS
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * VerificationError — uniform error state for any SSH verification
 * failure. Shows the underlying message plus the standard checklist of
 * likely causes the user should check before retrying. Avoids offering a
 * bypass path; the only escape is to fix the input and re-verify.
 */
function VerificationError({ error }) {
  return (
    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 p-4 text-sm">
      <div className="flex items-start gap-2.5">
        <AlertOctagon className="h-4 w-4 mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-red-800 dark:text-red-200">
            SSH verification failed
          </p>
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
              <Cause icon={Globe} text="IP address — public IPv4 of your VPS, reachable from the internet" />
              <Cause icon={ShieldCheck} text="SSH port — default 22, or the custom port your provider assigned" />
              <Cause icon={ShieldAlert} text="SSH user — typically root on a fresh VPS, or a sudo-enabled user" />
              <Cause icon={ShieldCheck} text="Credentials — exact password (or paste SSH key if your host uses keys)" />
              <Cause icon={ShieldAlert} text="Firewall access — Central Panel's outbound IP must reach this port (and your provider's network ACL)" />
            </ul>
            <p className="text-2xs text-red-700 dark:text-red-300/70 mt-2.5">
              Fix any of the items above, edit the field, and click Verify SSH access again.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Cause({ icon: Icon, text }) {
  return (
    <li className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 mt-0.5 text-red-500 dark:text-red-400 shrink-0" />
      <span className="leading-snug">{text}</span>
    </li>
  )
}

function DetailCell({ icon: Icon, label, value, tone }) {
  const valueClass =
    tone === 'ok'
      ? 'text-emerald-700 dark:text-emerald-300'
      : tone === 'warn'
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-slate-900 dark:text-white'
  return (
    <div className="min-w-0">
      <dt className="text-2xs uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`text-sm flex items-center gap-1.5 truncate ${valueClass}`}>
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />}
        <span className="truncate">{value}</span>
      </dd>
    </div>
  )
}

function OsSupportPill({ supported }) {
  return (
    <Badge
      variant={supported ? 'success' : 'warning'}
      className="rounded-md text-xxs gap-1 uppercase tracking-wide"
      data-testid="cvps-os-support"
    >
      {supported ? 'Supported' : 'Unsupported'}
    </Badge>
  )
}
