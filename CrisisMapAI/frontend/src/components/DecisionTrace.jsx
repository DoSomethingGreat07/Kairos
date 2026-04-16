import React, { useState } from 'react'

const STAGE_META = {
  priority_queue:       { label: 'Priority Queue',         icon: '⚡', color: 'rose' },
  bayesian_severity:    { label: 'Bayesian Severity',      icon: '📊', color: 'orange' },
  dispatch_mode:        { label: 'Rule Engine Dispatch',   icon: '🎯', color: 'amber' },
  dijkstra:             { label: 'Dijkstra Safe Routing',  icon: '🗺️', color: 'blue' },
  yen_routes:           { label: 'Yen K-Shortest Backup',  icon: '🔀', color: 'indigo' },
  hungarian_assignment: { label: 'Hungarian Assignment',   icon: '🤝', color: 'emerald' },
  gale_shapley:         { label: 'Gale-Shapley Volunteers', icon: '👥', color: 'teal' },
  min_cost_flow:        { label: 'Min-Cost Max-Flow',      icon: '📦', color: 'violet' },
}

const colorClasses = {
  rose:    { bg: 'bg-rose-50',    border: 'border-rose-200',   text: 'text-rose-700',    dot: 'bg-rose-500',    badge: 'bg-rose-100 text-rose-700' },
  orange:  { bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-700',  dot: 'bg-orange-500',  badge: 'bg-orange-100 text-orange-700' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-700',   dot: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700' },
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-700',    dot: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700' },
  indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200', text: 'text-indigo-700',  dot: 'bg-indigo-500',  badge: 'bg-indigo-100 text-indigo-700' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200',text: 'text-emerald-700', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  teal:    { bg: 'bg-teal-50',    border: 'border-teal-200',   text: 'text-teal-700',    dot: 'bg-teal-500',    badge: 'bg-teal-100 text-teal-700' },
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-200', text: 'text-violet-700',  dot: 'bg-violet-500',  badge: 'bg-violet-100 text-violet-700' },
}

const formatCompactValue = (value) => {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2)
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'none'
  if (typeof value === 'object') {
    const entries = Object.entries(value)
    if (!entries.length) return 'none'
    return entries
      .slice(0, 3)
      .map(([key, item]) => `${key}: ${typeof item === 'number' ? item.toFixed(2) : String(item)}`)
      .join(' · ')
  }
  return String(value)
}

const renderValue = (value) => {
  if (value === null || value === undefined) return <span className="text-slate-400 italic">—</span>
  if (typeof value === 'boolean') return value ? <span className="text-emerald-600 font-bold">Yes</span> : <span className="text-slate-400">No</span>
  if (typeof value === 'number') return <span className="font-bold font-mono">{Number.isInteger(value) ? value : value.toFixed(4)}</span>
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-slate-400 italic">none</span>
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {value.slice(0, 8).map((item, i) => (
          <span key={i} className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
            {typeof item === 'object' ? JSON.stringify(item).slice(0, 40) : String(item)}
          </span>
        ))}
        {value.length > 8 && <span className="text-xs text-slate-400">+{value.length - 8} more</span>}
      </div>
    )
  }
  if (typeof value === 'object') {
    return (
      <div className="mt-1 space-y-1">
        {Object.entries(value).slice(0, 10).map(([k, v]) => (
          <div key={k} className="flex items-start gap-2 text-xs">
            <span className="font-semibold text-slate-500 min-w-[80px]">{k.replace(/_/g, ' ')}:</span>
            <span className="text-slate-800 font-medium">{typeof v === 'object' ? JSON.stringify(v).slice(0, 60) : String(v)}</span>
          </div>
        ))}
      </div>
    )
  }
  return <span className="font-medium">{String(value)}</span>
}

const StageCard = ({ stageKey, data, meta, isExpanded, onToggle }) => {
  const c = colorClasses[meta.color] || colorClasses.blue

  // Extract key metrics to show in collapsed view
  const highlights = []
  if (stageKey === 'priority_queue') {
    highlights.push({ label: 'Score', value: data?.score })
  } else if (stageKey === 'bayesian_severity') {
    highlights.push({ label: 'Severity', value: data?.inferred_severity })
    if (data?.posterior) highlights.push({ label: 'Posterior', value: data.posterior })
  } else if (stageKey === 'dijkstra') {
    highlights.push({ label: 'ETA', value: data?.eta })
    highlights.push({ label: 'Cost', value: data?.route_cost })
    if (data?.route) highlights.push({ label: 'Hops', value: data.route.length })
  } else if (stageKey === 'hungarian_assignment') {
    highlights.push({ label: 'Responder', value: data?.responder_name })
    highlights.push({ label: 'Status', value: data?.status || (data?.assigned ? 'Assigned' : 'Unassigned') })
  } else if (stageKey === 'dispatch_mode') {
    highlights.push({ label: 'Destination', value: data?.destination })
    highlights.push({ label: 'Type', value: data?.responder_type })
  } else if (stageKey === 'yen_routes') {
    if (Array.isArray(data)) highlights.push({ label: 'Backup Routes', value: data.length })
  } else if (stageKey === 'min_cost_flow') {
    highlights.push({ label: 'Flow Cost', value: data?.flow_cost || data?.total_cost })
  }

  const explanation = typeof data === 'object' && data !== null ? (data.explanation || data.rationale) : null

  return (
    <div className={`rounded-[20px] border ${isExpanded ? c.border : 'border-slate-100'} ${isExpanded ? c.bg : 'bg-white'} transition-all duration-200`}>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="text-xl">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${c.text}`}>{meta.label}</span>
            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
          </div>
          {!isExpanded && highlights.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-1">
              {highlights.map(h => h.value != null && (
                <span key={h.label} className="text-xs text-slate-500">
                  {h.label}: <span className="font-bold text-slate-800">{formatCompactValue(h.value)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <svg className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Explanation block */}
          {explanation && (
            <div className={`rounded-xl ${c.badge} p-3 text-xs leading-relaxed`}>
              {typeof explanation === 'string' ? explanation : (
                <div className="space-y-1">
                  {Object.entries(explanation).map(([k, v]) => (
                    <div key={k}><span className="font-bold">{k.replace(/_/g, ' ')}:</span> {String(v)}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Data fields */}
          <div className="rounded-xl bg-white/80 p-3 space-y-2">
            {typeof data === 'object' && data !== null && !Array.isArray(data) ? (
              Object.entries(data)
                .filter(([k]) => k !== 'explanation' && k !== 'rationale')
                .map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <span className="font-semibold text-slate-500 uppercase tracking-wide">{key.replace(/_/g, ' ')}</span>
                    <div className="mt-0.5 text-slate-800">{renderValue(value)}</div>
                  </div>
                ))
            ) : Array.isArray(data) ? (
              <div className="text-xs text-slate-800">{renderValue(data)}</div>
            ) : (
              <div className="text-xs text-slate-800">{renderValue(data)}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const DecisionTrace = ({ algorithmResults, caseEvents }) => {
  const [expandedStages, setExpandedStages] = useState(new Set())

  const toggleStage = (key) => {
    setExpandedStages(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const expandAll = () => {
    setExpandedStages(new Set(Object.keys(STAGE_META)))
  }

  const collapseAll = () => {
    setExpandedStages(new Set())
  }

  if (!algorithmResults || Object.keys(algorithmResults).length === 0) {
    return (
      <div className="rounded-[24px] border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
        No algorithm results available for decision trace
      </div>
    )
  }

  const stages = Object.entries(STAGE_META)
    .filter(([key]) => {
      const val = algorithmResults[key]
      return val !== undefined && val !== null && (typeof val !== 'object' || Object.keys(val).length > 0 || (Array.isArray(val) && val.length > 0))
    })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            AI Decision Trace — {stages.length} Algorithms
          </h3>
        </div>
        <div className="flex gap-2">
          <button onClick={expandAll} className="text-xs font-semibold text-blue-600 hover:text-blue-800">Expand All</button>
          <span className="text-slate-300">|</span>
          <button onClick={collapseAll} className="text-xs font-semibold text-blue-600 hover:text-blue-800">Collapse</button>
        </div>
      </div>

      {/* Pipeline flow indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {stages.map(([key, meta], i) => {
          const c = colorClasses[meta.color]
          return (
            <React.Fragment key={key}>
              <button
                onClick={() => toggleStage(key)}
                className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-bold transition ${
                  expandedStages.has(key) ? `${c.badge}` : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {meta.icon} {meta.label.split(' ')[0]}
              </button>
              {i < stages.length - 1 && (
                <svg className="h-3 w-3 flex-shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Stage cards */}
      <div className="space-y-2">
        {stages.map(([key, meta]) => (
          <StageCard
            key={key}
            stageKey={key}
            data={algorithmResults[key]}
            meta={meta}
            isExpanded={expandedStages.has(key)}
            onToggle={() => toggleStage(key)}
          />
        ))}
      </div>

      {/* Case events timeline */}
      {caseEvents && caseEvents.length > 0 && (
        <div className="rounded-[20px] border border-slate-100 bg-white p-4">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Pipeline Event Log</h4>
          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-200" />
            <div className="space-y-3">
              {caseEvents.map((event, i) => (
                <div key={`${event.stage_name}-${i}`} className="relative pl-8">
                  <div className="absolute left-1.5 top-1 h-3 w-3 rounded-full border-2 border-white bg-slate-400 shadow-sm" />
                  <div>
                    <span className="text-xs font-bold text-slate-700">
                      {(event.stage_name || 'Event').replace(/_/g, ' ')}
                    </span>
                    <span className="ml-2 text-xs text-slate-400">{event.status || 'completed'}</span>
                    {event.timestamp && (
                      <span className="ml-2 text-xs text-slate-400">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DecisionTrace
