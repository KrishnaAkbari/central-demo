import { Server as ServerIcon } from 'lucide-react'

export function AuthShell({ hero, children }) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950">
      <aside className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 dark:from-indigo-950 dark:via-slate-950 dark:to-purple-950">
        <div
          className="absolute inset-0 opacity-[0.18] dark:opacity-[0.12]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="absolute -top-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-purple-500/30 dark:bg-purple-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-indigo-400/30 dark:bg-indigo-400/15 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full">
          <div className="flex-1 flex flex-col justify-center max-w-lg">{hero}</div>
          <p className="text-xs text-white/70">Demo build · Data stays in your browser</p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-12">
        <div className="w-full max-w-md space-y-6">{children}</div>
      </main>
    </div>
  )
}

export function AuthBrand({ tone = 'auto', className = '' }) {
  const wordColor =
    tone === 'light'
      ? 'text-white'
      : tone === 'dark'
      ? 'text-slate-900 dark:text-white'
      : 'text-slate-900 dark:text-white'
  const eyebrowColor =
    tone === 'light' ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-700 flex items-center justify-center shadow-lg shadow-indigo-500/20">
        <ServerIcon className="h-6 w-6 text-white" />
      </div>
      <div>
        <p className={`font-bold text-lg leading-none ${wordColor}`}>ServerAvatar</p>
        <p className={`text-xxs uppercase tracking-wider font-bold mt-0.5 ${eyebrowColor}`}>
          Central Panel · Demo
        </p>
      </div>
    </div>
  )
}

export function AuthHero({ eyebrow, headline, subtitle, features }) {
  return (
    <div className="space-y-10">
      <AuthBrand tone="light" />
      <div className="space-y-5">
        {eyebrow && (
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {eyebrow}
          </p>
        )}
        <h1 className="text-4xl xl:text-5xl font-bold tracking-tight leading-[1.1] text-white">
          {headline}
        </h1>
        <p className="text-base xl:text-lg text-white/80 leading-relaxed max-w-md">
          {subtitle}
        </p>
      </div>
      <ul className="space-y-5">
        {features.map((f, i) => {
          const Icon = f.icon
          return (
            <li key={i} className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center shrink-0 ring-1 ring-white/20">
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-white text-base">{f.title}</p>
                <p className="text-sm text-white/70 leading-relaxed mt-0.5">
                  {f.description}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}