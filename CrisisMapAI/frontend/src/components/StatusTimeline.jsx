import React, { useEffect, useState } from 'react'

import { deriveCountdowns, deriveTimelineStages, formatEtaLabel } from '../utils/incidentVisuals'

const stateClasses = {
  complete: 'bg-emerald-500 shadow-emerald-500/30',
  active: 'bg-cyan-500 shadow-cyan-500/30 animate-pulse',
  pending: 'bg-slate-200',
}

const StatusTimeline = ({ incident, simulation = null, compact = false }) => {
  const [nowMs, setNowMs] = useState(Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const stages = deriveTimelineStages(incident, simulation, nowMs)
  const countdowns = deriveCountdowns(incident, simulation, nowMs)

  return (
    <section className={`rounded-[28px] border border-white/90 bg-white/95 ${compact ? 'p-5' : 'p-6'} shadow-[0_18px_50px_rgba(15,23,42,0.08)]`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-600">Real-Time Status</p>
          <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Operational progress and ETA countdowns</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">Scene ETA: <span className="font-black text-slate-950">{formatEtaLabel(countdowns.responderEta)}</span></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">Transport: <span className="font-black text-slate-950">{formatEtaLabel(countdowns.transportEta)}</span></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">Destination: <span className="font-black text-slate-950">{formatEtaLabel(countdowns.destinationEta)}</span></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">Volunteer: <span className="font-black text-slate-950">{formatEtaLabel(countdowns.volunteerEta)}</span></div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {stages.map((step, index) => (
          <div key={step.key} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`h-4 w-4 rounded-full shadow-lg ${stateClasses[step.state] || stateClasses.pending}`} />
              {index < stages.length - 1 && <div className={`mt-1 w-px flex-1 ${step.state === 'complete' ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
            </div>
            <div className="pb-4">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-900">{step.label}</p>
              <p className="mt-1 text-sm font-medium text-slate-600">{step.meta}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default StatusTimeline
