import React from 'react'

import { deriveRouteVariants, getBlockedSegments } from '../utils/incidentVisuals'

const RouteVisualizationPanel = ({ incident, simulation = null }) => {
  const variants = deriveRouteVariants(incident, simulation)
  const blockedSegments = getBlockedSegments(incident)
  const visibleBlockedSegments = blockedSegments.slice(0, 5)
  const rerouted = simulation?.type === 'road_blocked' && variants.some((route) => route.label !== 'Primary' && route.isActive)

  return (
    <section className="rounded-[28px] border border-white/90 bg-white/95 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-600">Route Visualization</p>
          <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Primary path with live backup coverage</h3>
        </div>
        {rerouted && (
          <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700">
            Rerouted in real time
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {variants.length > 0 ? variants.map((route) => (
          <article
            key={route.id}
            className={`rounded-[22px] border p-4 transition-all ${
              route.isActive
                ? 'border-cyan-300 bg-cyan-50 shadow-[0_12px_30px_rgba(34,211,238,0.18)]'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">{route.label}</p>
                <p className="mt-2 text-xl font-black text-slate-950">{route.etaLabel}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${route.isActive ? 'bg-cyan-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
                {route.statusLabel}
              </span>
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-700">
              {Array.isArray(route.path) && route.path.length > 1 ? route.path.join(' → ') : 'Direct dispatch path'}
            </p>
            {route.explanation && (
              <p className="mt-3 text-xs leading-6 text-slate-500">{route.explanation}</p>
            )}
          </article>
        )) : (
          <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500 xl:col-span-3">
            No safe route variants are available for this incident yet.
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[22px] border border-rose-100 bg-rose-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-rose-600">Blocked / rejected roads</p>
          {blockedSegments.length > 0 ? (
            <div className="mt-3 space-y-2">
              {visibleBlockedSegments.map((segment, index) => (
                <div key={`${segment.road_id || 'blocked'}-${index}`} className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-rose-900">
                  {segment.label} rejected due to safety constraints.
                </div>
              ))}
              {blockedSegments.length > visibleBlockedSegments.length && (
                <div className="rounded-2xl border border-dashed border-rose-200 bg-white/70 px-4 py-3 text-sm font-medium text-rose-700">
                  +{blockedSegments.length - visibleBlockedSegments.length} more blocked segments hidden for readability.
                </div>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm font-medium text-rose-900">No blocked roads are currently forcing route rejection.</p>
          )}
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Routing posture</p>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <p><span className="font-bold text-slate-900">Live path:</span> {variants.find((route) => route.isActive)?.label || 'Unavailable'}</p>
            <p><span className="font-bold text-slate-900">Fallback count:</span> {Math.max(variants.length - 1, 0)}</p>
            <p><span className="font-bold text-slate-900">Switch condition:</span> blocked road, capacity failure, or simulation event</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default RouteVisualizationPanel
