import React, { useEffect, useState } from 'react'
import io from 'socket.io-client'
import { SOCKET_BASE_URL } from '../api/client'
import AssignmentPanel from './AssignmentPanel'
import StatusTimeline from './StatusTimeline'

const ResponderPanel = () => {
  const [assignments, setAssignments] = useState([])
  const [selectedAssignment, setSelectedAssignment] = useState(null)

  useEffect(() => {
    const socket = io(SOCKET_BASE_URL)

    socket.on('assignment_update', (data) => {
      setAssignments((prev) => {
        const next = [...prev.filter((assignment) => assignment.id !== data.id), data]
        return next.sort((a, b) => (a.priority_score || 0) < (b.priority_score || 0) ? 1 : -1)
      })
      setSelectedAssignment((current) => current || data)
    })

    return () => socket.disconnect()
  }, [])

  return (
    <div className="space-y-6">
      <section className="panel">
        <p className="section-kicker">Responder View</p>
        <h2 className="panel-title mt-2">Active assignment queue</h2>
        <p className="panel-subtitle">Incoming assignments are ordered by priority and kept ready for route acknowledgment.</p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="panel">
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <button
                key={assignment.id}
                type="button"
                className={`w-full rounded-[22px] border p-4 text-left transition ${
                  selectedAssignment?.id === assignment.id
                    ? 'border-slate-900 bg-slate-950 text-white'
                    : 'border-slate-100 bg-slate-50/80 hover:border-slate-200 hover:bg-white'
                }`}
                onClick={() => setSelectedAssignment(assignment)}
              >
                <p className="text-lg font-bold">{assignment.incident_type || assignment.disaster_type || 'Emergency'} - {assignment.zone}</p>
                <p className={`mt-1 text-sm ${selectedAssignment?.id === assignment.id ? 'text-slate-300' : 'text-slate-500'}`}>
                  Priority: {assignment.priority || assignment.severity || 'unknown'} • ETA: {assignment.eta || 'TBD'}
                </p>
              </button>
            ))}
            {assignments.length === 0 && (
              <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                No live assignments yet.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <AssignmentPanel assignment={selectedAssignment} />
          {selectedAssignment && (
            <div className="panel">
              <p className="section-kicker">Progress</p>
              <h3 className="panel-title mt-2">Incident timeline</h3>
              <div className="mt-5">
                <StatusTimeline incident={selectedAssignment} />
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default ResponderPanel
