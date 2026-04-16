import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { getProfile, submitSOS, transcribeAudioWithElevenLabs } from '../api/client'

const RECORDING_TIMEOUT_MS = 3_000
const ONE_SHOT_KEY_PREFIX = 'crisismap_voice_sos_triggered'
const KEYWORD_PATTERNS = ['help', 'please help', 'help me']

const isInteractiveTarget = (target) => {
  const tagName = target?.tagName?.toLowerCase()
  return ['input', 'textarea', 'select', 'button'].includes(tagName) || target?.isContentEditable
}

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))

const VoiceSOSButton = ({ session }) => {
  const navigate = useNavigate()
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const audioChunksRef = useRef([])
  const stopPromiseResolveRef = useRef(null)
  const timeoutRef = useRef(null)
  const submittingRef = useRef(false)
  const audioContextRef = useRef(null)

  const [profile, setProfile] = useState(null)
  const [status, setStatus] = useState('idle')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [hasTriggered, setHasTriggered] = useState(false)

  const isVictimSession = session?.role === 'victim' && !!session?.session_id
  const triggerKey = `${ONE_SHOT_KEY_PREFIX}:${session?.session_id || session?.subject_id || 'guest'}`

  useEffect(() => {
    setHasTriggered(window.sessionStorage.getItem(triggerKey) === '1')
  }, [triggerKey])

  useEffect(() => {
    let active = true

    const loadProfile = async () => {
      if (!isVictimSession) {
        setProfile(null)
        return
      }
      try {
        const result = await getProfile('victim', session.subject_id)
        if (active) setProfile(result)
      } catch {
        if (active) setProfile(null)
      }
    }

    loadProfile()
    return () => {
      active = false
    }
  }, [isVictimSession, session?.subject_id])

  useEffect(() => () => cleanupRecording(), [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.repeat || event.key?.toLowerCase() !== 'h') return
      if (isInteractiveTarget(event.target)) return
      event.preventDefault()
      if (status === 'recording') {
        stopRecording()
      } else {
        startVoiceFlow()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [status, isVictimSession, hasTriggered, profile])

  const buttonState = useMemo(() => {
    if (!isVictimSession) {
      return {
        label: 'Voice SOS unavailable',
        tooltip: 'Voice SOS requires an active victim session.',
        disabled: true,
        icon: 'mic',
      }
    }
    if (hasTriggered) {
      return {
        label: 'SOS already sent',
        tooltip: 'Voice SOS can only be triggered once per session.',
        disabled: true,
        icon: 'check',
      }
    }
    if (status === 'recording') {
      return {
        label: 'Listening...',
        tooltip: "Listening for 'Help'...",
        disabled: false,
        icon: 'mic',
      }
    }
    if (status === 'detected') {
      return {
        label: 'Help detected',
        tooltip: 'Help detected — sending SOS.',
        disabled: true,
        icon: 'check',
      }
    }
    if (status === 'submitted') {
      return {
        label: 'SOS Sent Successfully',
        tooltip: 'Emergency alert sent successfully.',
        disabled: true,
        icon: 'check',
      }
    }
    if (status === 'error') {
      return {
        label: 'Try voice SOS again',
        tooltip: error || "Tap to activate voice help",
        disabled: false,
        icon: 'mic',
      }
    }
    return {
      label: 'Tap to activate voice help',
      tooltip: "Press and say 'Help' to send emergency alert",
      disabled: false,
      icon: 'mic',
    }
  }, [error, hasTriggered, isVictimSession, status])

  const playBeep = async (frequency = 880, duration = 0.14) => {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext
    if (!AudioContextCtor) return

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor()
    }

    const context = audioContextRef.current
    if (context.state === 'suspended') {
      await context.resume()
    }

    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.value = 0.0001
    oscillator.connect(gain)
    gain.connect(context.destination)

    const now = context.currentTime
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    oscillator.start(now)
    oscillator.stop(now + duration)
  }

  const cleanupRecording = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
  }

  const stopRecording = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
  }

  const recordAudio = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream
    audioChunksRef.current = []

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'
    const recorder = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = recorder

    const stopped = new Promise((resolve) => {
      stopPromiseResolveRef.current = resolve
    })

    recorder.ondataavailable = (event) => {
      if (event.data?.size) {
        audioChunksRef.current.push(event.data)
      }
    }

    recorder.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      stream.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      mediaRecorderRef.current = null
      stopPromiseResolveRef.current?.(audioBlob)
      stopPromiseResolveRef.current = null
    }

    recorder.start(300)
    timeoutRef.current = window.setTimeout(() => stopRecording(), RECORDING_TIMEOUT_MS)

    return stopped
  }

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) return null

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: Number(position.coords.latitude.toFixed(6)),
            longitude: Number(position.coords.longitude.toFixed(6)),
          })
        },
        () => resolve(null),
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 120000,
        }
      )
    })
  }

  const buildSOSPayload = async () => {
    const profileData = profile?.profile_data || {}
    const identity = profileData.identity || {}
    const household = profileData.household_profile || {}
    const locationProfile = profileData.location_profile || {}
    const medical = profileData.medical_profile || {}
    const geolocation = await getCurrentLocation()

    const zone = locationProfile.home_zone || locationProfile.work_zone || locationProfile.frequent_zones?.[0] || ''
    const location = {
      zone: zone || undefined,
      latitude: geolocation?.latitude,
      longitude: geolocation?.longitude,
      gps: geolocation ? `${geolocation.latitude}, ${geolocation.longitude}` : undefined,
      area_type: 'Residential Area',
      access_difficulty: 'Unknown',
      floor_level: 'Not applicable',
    }

    return {
      victim_id: session.subject_id,
      voice_triggered: true,
      keyword_detected: 'help',
      timestamp: new Date().toISOString(),
      disaster_type: 'medical emergency',
      severity: 'high',
      people_count: household.household_size || 1,
      location,
      zone: zone || undefined,
      medical: {
        oxygen_required: !!medical.home_oxygen_device || !!medical.conditions?.requires_oxygen_or_respiratory_support,
        elderly: Boolean(household.elderly_members),
        elderly_count: household.elderly_members || undefined,
        children: Boolean(household.children_under_12),
        children_count: household.children_under_12 || undefined,
        disabled: Boolean(household.mobility_limited_members),
        disabled_count: household.mobility_limited_members || undefined,
      },
      access: {
        trapped: false,
        road_status: 'unknown',
        safe_exit: true,
        building_type: 'house',
      },
      contact: {
        name: identity.full_name || undefined,
        phone: identity.phone || undefined,
        language: identity.preferred_language || profile?.preferred_language || 'English',
      },
      notes: 'Voice SOS trigger activated from victim login page after keyword detection: help.',
    }
  }

  const processTranscript = async (transcript, retryCount = 0) => {
    const normalized = transcript.trim().toLowerCase()
    if (!normalized || !KEYWORD_PATTERNS.some((pattern) => normalized.includes(pattern))) {
      if (retryCount < 1) {
        setStatus('error')
        setFeedback('No speech detected. Listening again...')
        await wait(800)
        setStatus('recording')
        setFeedback("Listening for 'Help'...")
        try {
          const audioBlob = await recordAudio()
          const newTranscript = await transcribeAudioWithElevenLabs(audioBlob, session)
          await processTranscript(newTranscript, retryCount + 1)
        } catch (err) {
          setStatus('error')
          setFeedback('Could not detect speech. Please try again.')
        }
        return
      } else {
        throw new Error('Could not detect speech. Please try again.')
      }
    }

    setStatus('detected')
    setFeedback('Help detected — sending SOS')
    await playBeep(1240, 0.18)

    if (submittingRef.current) return
    submittingRef.current = true

    const payload = await buildSOSPayload()
    const response = await submitSOS(payload)

    window.sessionStorage.setItem(triggerKey, '1')
    setHasTriggered(true)
    setStatus('submitted')
    setFeedback('SOS Sent Successfully')
    const victimId = session?.subject_id || ''
    navigate(`/victim/${response.sos_id}${victimId ? `?victimId=${victimId}` : ''}`)
  }

  const startVoiceFlow = async () => {
    if (!isVictimSession || hasTriggered || status === 'recording' || submittingRef.current) {
      return
    }
    if (!navigator.onLine) {
      setStatus('error')
      setError('Unable to send SOS. Try again.')
      setFeedback('Unable to send SOS. Try again.')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setStatus('error')
      setError('Microphone permission required for voice SOS.')
      setFeedback('Microphone permission required for voice SOS.')
      return
    }

    setError('')
    setFeedback("Listening for 'Help'...")
    setStatus('recording')

    try {
      await playBeep(880, 0.12)
      const audioBlob = await recordAudio()
      const transcript = await transcribeAudioWithElevenLabs(audioBlob, session)
      await processTranscript(transcript)
    } catch (voiceError) {
      const denied = voiceError?.name === 'NotAllowedError' || voiceError?.name === 'SecurityError'
      const message = denied
        ? 'Microphone permission required for voice SOS.'
        : voiceError?.message || 'Could not detect speech. Please try again.'
      setStatus('error')
      setError(message)
      setFeedback(message)
      cleanupRecording()
    } finally {
      submittingRef.current = false
    }
  }

  const handleClick = async () => {
    if (status === 'recording') {
      stopRecording()
      return
    }
    await startVoiceFlow()
  }

  return (
    <div className="voice-sos-shell" aria-live="polite">
      <button
        type="button"
        className={`voice-sos-button ${status === 'recording' ? 'voice-sos-button-recording' : ''} ${status === 'submitted' ? 'voice-sos-button-success' : ''}`}
        onClick={handleClick}
        disabled={buttonState.disabled}
        aria-label={buttonState.tooltip}
        title={buttonState.tooltip}
      >
        <span className="voice-sos-ring" aria-hidden="true" />
        <span className="voice-sos-icon" aria-hidden="true">
          {buttonState.icon === 'check' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a3 3 0 013 3v6a3 3 0 11-6 0V6a3 3 0 013-3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-14 0M12 18v3M8 21h8" />
            </svg>
          )}
        </span>
      </button>

      <div className="voice-sos-tooltip">
        <p className="voice-sos-tooltip-title">{buttonState.label}</p>
        <p className="voice-sos-tooltip-copy">{feedback || buttonState.tooltip}</p>
        <p className="voice-sos-tooltip-hint">Press <span>H</span> to activate microphone.</p>
      </div>
    </div>
  )
}

export default VoiceSOSButton
