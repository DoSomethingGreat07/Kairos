import React from 'react'

import { deriveDecisionTrace } from '../utils/incidentVisuals'

const toneClasses = {
  primary: 'border-cyan-100 bg-cyan-50 text-cyan-950',
  warning: 'border-amber-100 bg-amber-50 text-amber-950',
  danger: 'border-rose-100 bg-rose-50 text-rose-950',
  success: 'border-emerald-100 bg-emerald-50 text-emerald-950',
  neutral: 'border-slate-200 bg-slate-50 text-slate-900',
}

const DecisionTracePanel = ({ incident, simulation = null, activeStepIndex = null }) => {
  const steps = deriveDecisionTrace(incident, simulation)

  return (
    <section className="rounded-[28px] border border-white/90 bg-white/95 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-indigo-600">Decision Trace</p>
          <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Why the system made this decision</h3>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          Explainability panel
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {steps.map((step, index) => (
          <article
            key={`${step.title}-${index}`}
            className={`rounded-[22px] border p-4 ${toneClasses[step.tone] || toneClasses.neutral} ${
              activeStepIndex === index ? 'ring-2 ring-indigo-400 shadow-[0_0_0_4px_rgba(99,102,241,0.14)]' : ''
            }`}
          >
            <div className="flex gap-4">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/80 text-sm font-black shadow-sm">
                {index + 1}
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] opacity-75">{step.title}</p>
                <p className="mt-2 text-sm leading-6">{step.detail}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default DecisionTracePanel
