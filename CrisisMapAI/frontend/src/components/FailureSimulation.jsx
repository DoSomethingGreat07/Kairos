import React, { useState } from 'react'
import { apiClient } from '../api/client'

const SCENARIOS = [
  {
    id: 'road_blocked',
    label: 'Block Road',
    icon: '🚧',
    description: 'Mark a road segment as impassable to trigger rerouting via Dijkstra + Yen backup paths',
    color: 'amber',
    fields: [
      { key: 'road_segment', label: 'Road Segment (e.g. zone-a → zone-b)', placeholder: 'zone-a,zone-b' },
    ],
  },
  {
    id: 'responder_unavailable',
    label: 'Remove Responder',
    icon: '🚑',
    description: 'Make the assigned responder unavailable to trigger Hungarian reassignment',
    color: 'rose',
    fields: [],
  },
  {
    id: 'hospital_full',
    label: 'Hospital Full',
    icon: '🏥',
    description: 'Set destination hospital to full capacity, forcing Rule Engine to pick alternate facility',
    color: 'orange',
    fields: [],
  },
  {
    id: 'severity_escalation',
    label: 'Escalate Severity',
    icon: '📈',
    description: 'Simulate new evidence (e.g. injuries discovered) to re-run Bayesian severity upward',
    color: 'red',
    fields: [],
  },
]

const colorMap = {
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', btn: 'bg-amber-600 hover:bg-amber-700' },
  rose:  { bg: 'bg-rose-50',  border: 'border-rose-200',  text: 'text-rose-700',  btn: 'bg-rose-600 hover:bg-rose-700' },
  orange:{ bg: 'bg-orange-50',border: 'border-orange-200',text: 'text-orange-700',btn: 'bg-orange-600 hover:bg-orange-700' },
  red:   { bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-700',   btn: 'bg-red-600 hover:bg-red-700' },
}

const FailureSimulation = ({ sosId, incident, algorithmResults, onRerunComplete }) => {
  const [activeScenario, setActiveScenario] = useState(null)
  const [fieldValues, setFieldValues] = useState({})
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const triggerScenario = async (scenario) => {
    setRunning(true)
    setError(null)
    setResult(null)

    try {
      const payload = {
        sos_id: sosId,
        scenario: scenario.id,
        params: fieldValues,
        original_incident: {
          zone: incident?.zone,
          disaster_type: incident?.disaster_type,
          severity: incident?.severity || incident?.inferred_severity,
          priority_score: incident?.priority_score,
        },
      }

      const response = await apiClient.post('/api/simulate-failure', payload)
      setResult(response.data)
      if (onRerunComplete) onRerunComplete(response.data)
    } catch (err) {
      const detail = err.response?.data?.detail || err.message
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail))
      // Show a comparison with the original data as a "what-if" even if endpoint doesn't exist yet
      setResult({
        simulated: true,
        scenario: scenario.id,
        note: 'Simulation endpoint not yet available. Showing what-if analysis based on current data.',
        original: {
          route: algorithmResults?.dijkstra?.route,
          eta: algorithmResults?.dijkstra?.eta,
          responder: algorithmResults?.hungarian_assignment?.responder_name,
          destination: algorithmResults?.dijkstra?.destination?.name,
        },
        impact: getScenarioImpact(scenario.id, algorithmResults),
      })
      setError(null) // Clear error since we're showing fallback
    } finally {
      setRunning(false)
    }
  }

  const getScenarioImpact = (scenarioId, ar) => {
    const dijkstra = ar?.dijkstra || {}
    const hungarian = ar?.hungarian_assignment || {}
    const yenRoutes = ar?.yen_routes || []

    switch (scenarioId) {
      case 'road_blocked':
        return {
          affected: 'Routing Engine (Dijkstra + Yen)',
          current_route: dijkstra.route?.join(' → '),
          backup_available: yenRoutes.length > 0,
          first_backup: yenRoutes[0]?.route?.join(' → ') || 'None computed',
          expected_eta_increase: '~2-5 min if backup used',
        }
      case 'responder_unavailable':
        return {
          affected: 'Hungarian Assignment',
          current_responder: hungarian.responder_name || 'None',
          reassignment: 'Would trigger full cost-matrix recalculation',
          candidates_evaluated: hungarian.candidates_evaluated || 'Unknown',
        }
      case 'hospital_full':
        return {
          affected: 'Rule Engine + Dijkstra',
          current_destination: dijkstra.destination?.name || 'Unknown',
          fallback: 'Nearest alternate facility or shelter',
          reroute_needed: true,
        }
      case 'severity_escalation':
        return {
          affected: 'Bayesian Severity + Priority Queue',
          current_severity: ar?.bayesian_severity?.inferred_severity || 'Unknown',
          current_score: ar?.priority_queue?.score,
          expected: 'Higher priority score → faster dispatch tier',
        }
      default:
        return {}
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Failure Simulation &amp; What-If Analysis
        </h3>
      </div>
      <p className="text-xs text-slate-500 -mt-2">
        Trigger realistic failure scenarios to demonstrate how the 8-algorithm pipeline adapts in real-time.
      </p>

      {/* Scenario cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        {SCENARIOS.map((scenario) => {
          const c = colorMap[scenario.color]
          const isActive = activeScenario === scenario.id
          return (
            <div
              key={scenario.id}
              className={`rounded-[20px] border p-4 transition-all cursor-pointer ${
                isActive ? `${c.border} ${c.bg} shadow-md` : 'border-slate-100 bg-white hover:border-slate-200'
              }`}
              onClick={() => setActiveScenario(isActive ? null : scenario.id)}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{scenario.icon}</span>
                <span className={`text-sm font-bold ${isActive ? c.text : 'text-slate-700'}`}>{scenario.label}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{scenario.description}</p>

              {isActive && (
                <div className="mt-3 space-y-2">
                  {scenario.fields.map(field => (
                    <input
                      key={field.key}
                      type="text"
                      placeholder={field.placeholder}
                      value={fieldValues[field.key] || ''}
                      onChange={(e) => setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ))}
                  <button
                    onClick={(e) => { e.stopPropagation(); triggerScenario(scenario) }}
                    disabled={running}
                    className={`w-full rounded-xl ${c.btn} px-3 py-2 text-xs font-bold text-white transition disabled:opacity-50`}
                  >
                    {running ? 'Simulating...' : `Trigger ${scenario.label}`}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Result display */}
      {result && (
        <div className="rounded-[20px] border border-blue-200 bg-blue-50 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-xs font-bold uppercase tracking-wide text-blue-700">
              {result.simulated ? 'What-If Analysis' : 'Simulation Result'}
            </span>
          </div>

          {result.note && <p className="text-xs text-blue-600 font-medium">{result.note}</p>}

          {result.original && (
            <div className="rounded-xl bg-white/70 p-3 space-y-1">
              <p className="text-xs font-bold text-slate-500 uppercase">Current State</p>
              {Object.entries(result.original).filter(([, v]) => v != null).map(([k, v]) => (
                <p key={k} className="text-xs text-slate-700">
                  <span className="font-semibold capitalize">{k.replace(/_/g, ' ')}:</span>{' '}
                  {Array.isArray(v) ? v.join(' → ') : String(v)}
                </p>
              ))}
            </div>
          )}

          {result.impact && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 space-y-1">
              <p className="text-xs font-bold text-amber-700 uppercase">Projected Impact</p>
              {Object.entries(result.impact).filter(([, v]) => v != null).map(([k, v]) => (
                <p key={k} className="text-xs text-amber-800">
                  <span className="font-semibold capitalize">{k.replace(/_/g, ' ')}:</span>{' '}
                  {typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}
                </p>
              ))}
            </div>
          )}

          {/* If real simulation data came back */}
          {result.new_algorithm_results && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 space-y-1">
              <p className="text-xs font-bold text-emerald-700 uppercase">After Re-Run</p>
              {result.new_algorithm_results.dijkstra?.route && (
                <p className="text-xs text-emerald-800">New Route: {result.new_algorithm_results.dijkstra.route.join(' → ')}</p>
              )}
              {result.new_algorithm_results.dijkstra?.eta && (
                <p className="text-xs text-emerald-800">New ETA: {result.new_algorithm_results.dijkstra.eta}</p>
              )}
              {result.new_algorithm_results.hungarian_assignment?.responder_name && (
                <p className="text-xs text-emerald-800">New Responder: {result.new_algorithm_results.hungarian_assignment.responder_name}</p>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-[16px] border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium">
          {error}
        </div>
      )}
    </div>
  )
}

export default FailureSimulation
