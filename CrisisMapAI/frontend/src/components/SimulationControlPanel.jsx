import React from 'react'

import { getSimulationScenarioMeta } from '../utils/incidentVisuals'

const scenarios = ['road_blocked', 'responder_unavailable', 'hospital_full', 'shelter_full']

const SimulationControlPanel = ({ simulation, onActivate, onReset }) => {
  return (
    <section className="rounded-[28px] border border-slate-900/10 bg-slate-900 p-6 text-white shadow-[0_26px_90px_rgba(15,23,42,0.22)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-amber-300">Failure Simulation</p>
          <h3 className="mt-1 text-2xl font-black tracking-tight">Stress-test reassignment and rerouting live</h3>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-white/15"
        >
          Reset Demo State
        </button>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {scenarios.map((scenario) => {
          const meta = getSimulationScenarioMeta(scenario)
          const active = simulation?.type === scenario
          return (
            <button
              key={scenario}
              type="button"
              onClick={() => onActivate({ type: scenario, ...meta, activatedAt: Date.now() })}
              className={`rounded-[22px] border p-4 text-left transition ${
                active
                  ? 'border-amber-300 bg-amber-400/15 shadow-[0_10px_30px_rgba(251,191,36,0.12)]'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <p className="text-sm font-black uppercase tracking-[0.18em] text-white">{meta?.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{meta?.impact}</p>
            </button>
          )
        })}
      </div>

      <div className="mt-5 rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
        {simulation?.type
          ? `Active disruption: ${simulation.title}. ${simulation.impact}`
          : 'No disruption is active. Use these controls during the demo to force route changes, destination churn, and reassignment explanations.'}
      </div>
    </section>
  )
}

export default SimulationControlPanel
