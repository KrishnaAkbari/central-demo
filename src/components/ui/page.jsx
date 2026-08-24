"use client"

import * as React from "react"
import { cn } from "@/utils"

// PageContainer — standard centered content shell with consistent padding
// and max-width. Use for every authenticated route. `size` maps to the
// longest sensible content width per page (forms = sm, list/detail
// pages = md, dashboards/grids = lg). Defaults to `md` so just omitting
// the prop on a typical list page still works.
const sizeMap = {
  sm: "max-w-2xl",
  md: "max-w-5xl",
  lg: "max-w-7xl",
}

function PageContainer({ className, size = "md", children, ...props }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8",
        sizeMap[size] ?? sizeMap.md,
        "space-y-6 sm:space-y-8",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// PageHeader — consistent page title + description + primary action
// structure. Renders a `<header>` with bottom border, responsive flex
// (stacks on mobile, side-by-side on >= sm), and an inline-actions slot
// for secondary buttons (Cancel, Back).
function PageHeader({
  title,
  description,
  eyebrow,
  children, // primary action goes here
  className,
  ...props
}) {
  return (
    <header
      className={cn(
        "flex flex-col sm:flex-row sm:items-start sm:justify-between sm:flex-wrap gap-3 sm:gap-4",
        "border-b border-slate-200/70 dark:border-slate-800 pb-5 sm:pb-6",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 sm:min-w-[200px] flex-1">
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            {eyebrow}
          </p>
        )}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2 shrink-0 sm:pt-1">
          {children}
        </div>
      )}
    </header>
  )
}

// PageBreadcrumb — simple slash-separated breadcrumb for routes that
// need hierarchy (Servers > Add > Verify). Renders above `<h1>` of the
// PageHeader when slotted via `eyebrow` (use `<PageBreadcrumb>` as the
// eyebrow), or directly inside custom headers.
function PageBreadcrumb({ items, className }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex flex-wrap items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400",
        className,
      )}
    >
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && (
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
              /
            </span>
          )}
          {item.href ? (
            <a
              href={item.href}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              {item.label}
            </a>
          ) : (
            <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

// EmptyState — standard "nothing here yet" tile. Icon on top, title,
// description, optional primary action. Three variants: `card` (default,
// renders a Card wrapper), `page` (renders inside the page).
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "card",
  className,
}) {
  const body = (
    <>
      {Icon && (
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 ring-1 ring-indigo-100 dark:ring-indigo-500/20">
          <Icon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </>
  )

  if (variant === "raw") return <div className={cn("py-10 text-center", className)}>{body}</div>

  // Card variant — used for content-level empty states
  return (
    <Card className={cn("p-10 sm:p-12 text-center", className)}>
      {body}
    </Card>
  )
}

// LoadingState — consistent loading spinner block. Wraps the page-level
// (full-bleed) initial-load case. For partial/inline loading, prefer the
// raw `<Loader2 className="h-4 w-4 animate-spin" />` pattern.
function LoadingState({ label = "Loading…", className }) {
  return (
    <Card className={cn("p-12 text-center", className)}>
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-3"
      >
        <span className="relative inline-flex h-10 w-10 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-indigo-400/30" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-indigo-500" />
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      </div>
    </Card>
  )
}

// AccessDenied — shown in place of a page when `useCan('organization.dashboard.view')`
// is false. Copy matches the existing Members-page card so users see
// a consistent refusal shape across pages.
function AccessDenied({ module = "this section" }) {
  return (
    <PageContainer size="sm">
      <Card className="p-10 sm:p-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700">
          <LockKeyhole className="h-6 w-6 text-slate-500 dark:text-slate-400" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          No access
        </h3>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          You don&apos;t have permission to view {module}. Ask an
          organization admin to grant you access.
        </p>
      </Card>
    </PageContainer>
  )
}

// Local imports kept at the bottom so the visual code above reads top
// to bottom without indirection.
import { Card } from "./card"
import { LockKeyhole } from "lucide-react"

export {
  PageContainer,
  PageHeader,
  PageBreadcrumb,
  EmptyState,
  LoadingState,
  AccessDenied,
}
