import React, { useEffect, useState } from 'react'

const STAGES = [
  { key: 'received',   label: 'SOS Received',     icon: '📡' },
  { key: 'triaged',    label: 'Triaged',           icon: '⚡' },
  { key: 'routed',     label: 'Route Calculated',  icon: '🗺️' },
  { key: 'assigned',   label: 'Responder Matched', icon: '🤝' },
  { key: 'en_route',   label: 'En Route',          icon: '🚑' },
  { key: 'arrived',    label: 'On Scene',          icon: '📍' },
  { key: 'resolved',   label: 'Resolved',          icon: '✅' },
]

const mapStatusToStageIndex = (status, caseEvents) => {
  if (!status && (!caseEvents || caseEvents.length === 0)) return 0

  const stageMap = {
    received: 0, queued: 0,
    triaged: 1, priority_assigned: 1, severity_inferred: 1,
    routed: 2, route_generated: 2,
    assigned: 3, processed: 3, responder_matched: 3,
    en_route: 4, dispatched: 4,
    arrived: 5, on_scene: 5,
    resolved: 6, completed: 6,
    blocked_access: 3,
  }

  // Check case events for most advanced stage
  let maxIndex = stageMap[status?.toLowerCase()] ?? 0
  if (caseEvents) {
    for (const event of caseEvents) {
      const eventName = (event.stage_name || '').toLowerCase()
      if (eventName.includes('sos_created')) maxIndex = Math.max(maxIndex, 0)
      if (eventName.includes('priority')) maxIndex = Math.max(maxIndex, 1)
      if (eventName.includes('severity')) maxIndex = Math.max(maxIndex, 1)
      if (eventName.includes('route')) maxIndex = Math.max(maxIndex, 2)
      if (eventName.includes('responder')) maxIndex = Math.max(maxIndex, 3)
      if (eventName.includes('volunteer')) maxIndex = Math.max(maxIndex, 3)
      if (eventName.includes('supply')) maxIndex = Math.max(maxIndex, 3)
    }
  }
  return maxIndex
}

const ETACountdown = ({ eta }) => {
  const [display, setDisplay] = useState(eta || '--')

  useEffect(() => {
    if (!eta || typeof eta !== 'string') return
    // If eta contains "min", parse and countdown
    const match = eta.match(/(\d+(?:\.\d+)?)\s*min/i)
    if (!match) { setDisplay(eta); return }

    let remainingSeconds = Math.round(parseFloat(match[1]) * 60)
    const tick = () => {
      if (remainingSeconds <= 0) { setDisplay('Arriving now'); return }
      const mins = Math.floor(remainingSeconds / 60)
      const secs = remainingSeconds % 60
      setDisplay(`${mins}:${String(secs).padStart(2, '0')}`)
      remainingSeconds--
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [eta])

  return <span className="font-mono">{display}</span>
}

const ETATimeline = ({ incident, algorithmResults, caseEvents }) => {
  const status = incident?.status || algorithmResults?.case_trace?.status || 'received'
  const dijkstra = algorithmResults?.dijkstra || {}
  const hungarian = algorithmResults?.hungarian_assignment || {}

  const currentStageIndex = mapStatusToStageIndex(status, caseEvents)
  const eta = incident?.eta || dijkstra.eta || hungarian.eta
  const isBlocked = status === 'blocked_access'

  return (
    <div className="space-y-5">
      {/* ETA hero card */}
      <div className={`rounded-[24px] p-6 ${isBlocked ? 'bg-amber-900' : 'bg-slate-900'} text-white shadow-lg`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Estimated Arrival</p>
            <p className="mt-2 text-4xl font-black tracking-tight">
              {isBlocked ? (
                <span className="text-amber-300">Route Blocked</span>
              ) : eta ? (
                <ETACountdown eta={eta} />
              ) : (
                <span className="text-slate-400">Calculating...</span>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {dijkstra.route_cost != null && (
              <span className="text-xs text-slate-400">Route cost: <span className="font-bold text-white">{typeof dijkstra.route_cost === 'number' ? dijkstra.route_cost.toFixed(1) : dijkstra.route_cost}</span></span>
            )}
            {hungarian.responder_name && (
              <span className="text-xs text-slate-400">Responder: <span className="font-bold text-blue-300">{hungarian.responder_name}</span></span>
            )}
          </div>
        </div>
      </div>

      {/* Stage progress timeline */}
      <div className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-5">Response Progress</h3>
        
        <div className="relative">
          {/* Progress bar */}
          <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-slate-200" />
          <div
            className="absolute left-[15px] top-0 w-0.5 bg-blue-500 transition-all duration-700"
            style={{ height: `${Math.min(100, (currentStageIndex / (STAGES.length - 1)) * 100)}%` }}
          />

          <div className="space-y-6">
            {STAGES.map((stage, i) => {
              const isPast = i < currentStageIndex
              const isCurrent = i === currentStageIndex
              const isFuture = i > currentStageIndex

              return (
                <div key={stage.key} className="relative flex items-start gap-4 pl-1">
                  {/* Node */}
                  <div className={`relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                    isCurrent ? 'border-blue-500 bg-blue-500 text-white shadow-lg shadow-blue-500/30 scale-110' :
                    isPast ? 'border-emerald-500 bg-emerald-500 text-white' :
                    'border-slate-200 bg-white text-slate-400'
                  }`}>
                    {isPast ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <span className="text-sm">{stage.icon}</span>
                    )}
                    {isCurrent && (
                      <span className="absolute inset-0 animate-ping rounded-full bg-blue-400 opacity-30" />
                    )}
                  </div>

                  {/* Label */}
                  <div className={`pt-1 ${isFuture ? 'opacity-40' : ''}`}>
                    <p className={`text-sm font-bold ${isCurrent ? 'text-blue-700' : isPast ? 'text-slate-900' : 'text-slate-400'}`}>
                      {stage.label}
                    </p>
                    {isCurrent && !isBlocked && (
                      <p className="mt-0.5 text-xs text-blue-500 font-semibold animate-pulse">In progress...</p>
                    )}
                    {isCurrent && isBlocked && (
                      <p className="mt-0.5 text-xs text-amber-600 font-semibold">Access blocked — rerouting</p>
                    )}
                    {isPast && caseEvents && (() => {
                      const matchingEvent = caseEvents.find(e => {
                        const name = (e.stage_name || '').toLowerCase()
                        if (stage.key === 'received') return name.includes('sos_created')
                        if (stage.key === 'triaged') return name.includes('priority') || name.includes('severity')
                        if (stage.key === 'routed') return name.includes('route')
                        if (stage.key === 'assigned') return name.includes('responder') || name.includes('volunteer')
                        return false
                      })
                      if (matchingEvent?.timestamp) {
                        return <p className="mt-0.5 text-xs text-slate-400">{new Date(matchingEvent.timestamp).toLocaleTimeString()}</p>
                      }
                      return null
                    })()}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ETATimeline
