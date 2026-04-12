import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { submitSOS } from '../api/client'

const disasterOptions = ['Fire', 'Flood', 'Earthquake', 'Storm', 'Landslide', 'Medical Emergency']
const severityOptions = ['Low', 'Medium', 'High', 'Critical']
const areaTypeOptions = [
  'Residential Area',
  'Apartment / Building',
  'School / College',
  'Hospital',
  'Road / Highway',
  'Market / Public Area',
  'Industrial Area',
  'Shelter Camp',
  'Other',
]
const injurySeverityOptions = ['Minor', 'Moderate', 'Severe', 'Critical']
const roadOptions = ['Clear', 'Blocked', 'Unknown']
const buildingOptions = ['Apartment', 'House', 'Road', 'Public Building', 'Industrial']
const languageOptions = ['English', 'Spanish', 'Hindi', 'Telugu', 'Other']
const accessDifficultyOptions = ['Easy to access', 'Narrow access', 'Blocked road', 'Flooded route', 'Fire/smoke obstruction', 'Unknown']
const floorOptions = ['Ground floor', '1st floor', '2nd floor', '3rd floor or above', 'Rooftop', 'Basement', 'Not applicable']

const initialFormData = {
  disasterType: 'Fire',
  zone: '',
  areaType: 'Residential Area',
  landmark: '',
  placeName: '',
  streetAccess: '',
  latitude: '',
  longitude: '',
  accessDifficulty: 'Unknown',
  floorLevel: 'Not applicable',
  nearbySafeSpot: '',
  severity: 'Medium',
  peopleCount: 1,
  injuriesPresent: false,
  injuredCount: 1,
  injurySeverity: 'Moderate',
  oxygenRequired: false,
  oxygenCount: 1,
  elderlyInvolved: false,
  elderlyCount: 1,
  childrenInvolved: false,
  childrenCount: 1,
  disabledSupport: false,
  disabledCount: 1,
  trappedIndoors: 'No',
  roadAccessibility: 'Unknown',
  safeExitAvailable: 'Yes',
  buildingType: 'House',
  contactName: '',
  phoneNumber: '',
  preferredLanguage: 'English',
  additionalNotes: '',
  confirmationChecked: false,
  useCurrentLocation: false,
}

const phonePattern = /^\+?[0-9\s().-]{7,20}$/
const numericPattern = /^-?\d+(\.\d+)?$/

const toNumberOrUndefined = (value) => (value === '' ? undefined : Number(value))

const resolveAreaType = (geoData) => {
  const category = `${geoData?.category || ''} ${geoData?.type || ''}`.toLowerCase()
  if (category.includes('hospital')) return 'Hospital'
  if (category.includes('school') || category.includes('college') || category.includes('university')) return 'School / College'
  if (category.includes('industrial')) return 'Industrial Area'
  if (category.includes('residential') || category.includes('house')) return 'Residential Area'
  if (category.includes('apartments') || category.includes('building')) return 'Apartment / Building'
  if (category.includes('highway') || category.includes('road')) return 'Road / Highway'
  if (category.includes('market') || category.includes('commercial') || category.includes('retail')) return 'Market / Public Area'
  if (category.includes('shelter') || category.includes('camp')) return 'Shelter Camp'
  return 'Other'
}

const formatCustomZone = (address = {}) => {
  const locality = address.suburb || address.neighbourhood || address.city_district || address.city || address.town || address.village
  const region = address.state || address.county
  return [locality, region].filter(Boolean).join(', ')
}

const formatStreetAccess = (address = {}) => {
  const road = [address.house_number, address.road].filter(Boolean).join(' ')
  const locality = address.suburb || address.neighbourhood || address.city_district
  return [road, locality].filter(Boolean).join(', ')
}

const SOSForm = () => {
  const [formData, setFormData] = useState(initialFormData)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submittedSosId, setSubmittedSosId] = useState('')
  const [locationStatus, setLocationStatus] = useState('')
  const [locating, setLocating] = useState(false)

  const criticalNeeds = useMemo(() => {
    const needs = []
    if (formData.injuriesPresent) needs.push(`${formData.injuredCount} injured (${formData.injurySeverity.toLowerCase()})`)
    if (formData.oxygenRequired) needs.push(`Oxygen x${formData.oxygenCount}`)
    if (formData.elderlyInvolved) needs.push(`${formData.elderlyCount} elderly`)
    if (formData.childrenInvolved) needs.push(`${formData.childrenCount} children`)
    if (formData.disabledSupport) needs.push(`${formData.disabledCount} mobility support`)
    if (formData.trappedIndoors === 'Yes') needs.push('Trapped indoors')
    if (formData.accessDifficulty !== 'Unknown') needs.push(formData.accessDifficulty)
    return needs
  }, [formData])

  const vulnerableCountTotal = useMemo(
    () => [formData.childrenInvolved ? Number(formData.childrenCount) : 0,
      formData.elderlyInvolved ? Number(formData.elderlyCount) : 0,
      formData.disabledSupport ? Number(formData.disabledCount) : 0,
      formData.injuriesPresent ? Number(formData.injuredCount) : 0].reduce((sum, count) => sum + count, 0),
    [formData]
  )

  const payload = useMemo(() => {
    const latitude = toNumberOrUndefined(formData.latitude)
    const longitude = toNumberOrUndefined(formData.longitude)
    const zoneValue = formData.zone.trim()
    const gpsFallback = latitude !== undefined && longitude !== undefined ? `${latitude}, ${longitude}` : undefined

    return {
      disaster_type: formData.disasterType.toLowerCase(),
      location: {
        zone: zoneValue || undefined,
        area_type: formData.areaType,
        landmark: formData.landmark.trim() || undefined,
        place_name: formData.placeName.trim() || undefined,
        street_access: formData.streetAccess.trim() || undefined,
        latitude,
        longitude,
        gps: gpsFallback,
        access_difficulty: formData.accessDifficulty,
        floor_level: formData.floorLevel,
        nearby_safe_spot: formData.nearbySafeSpot.trim() || undefined,
      },
      severity: formData.severity.toLowerCase(),
      people_count: Number(formData.peopleCount),
      medical: {
        injuries: formData.injuriesPresent,
        injured_count: formData.injuriesPresent ? Number(formData.injuredCount) : undefined,
        injury_severity: formData.injuriesPresent ? formData.injurySeverity.toLowerCase() : undefined,
        oxygen_required: formData.oxygenRequired,
        oxygen_count: formData.oxygenRequired ? Number(formData.oxygenCount) : undefined,
        elderly: formData.elderlyInvolved,
        elderly_count: formData.elderlyInvolved ? Number(formData.elderlyCount) : undefined,
        children: formData.childrenInvolved,
        children_count: formData.childrenInvolved ? Number(formData.childrenCount) : undefined,
        disabled: formData.disabledSupport,
        disabled_count: formData.disabledSupport ? Number(formData.disabledCount) : undefined,
      },
      access: {
        trapped: formData.trappedIndoors === 'Yes',
        road_status: formData.roadAccessibility.toLowerCase(),
        safe_exit: formData.safeExitAvailable === 'Yes',
        building_type: formData.buildingType.toLowerCase(),
      },
      contact: {
        name: formData.contactName.trim() || undefined,
        phone: formData.phoneNumber.trim() || undefined,
        language: formData.preferredLanguage,
      },
      zone: zoneValue || undefined,
      notes: formData.additionalNotes.trim() || undefined,
    }
  }, [formData])

  const validationErrors = useMemo(() => {
    const issues = []
    if (Number(formData.peopleCount) < 1) issues.push('People count must be at least 1.')
    if (formData.phoneNumber.trim() && !phonePattern.test(formData.phoneNumber.trim())) issues.push('Phone number format is invalid.')
    if (formData.latitude && !numericPattern.test(formData.latitude.trim())) issues.push('Latitude must be numeric.')
    if (formData.longitude && !numericPattern.test(formData.longitude.trim())) issues.push('Longitude must be numeric.')
    if ((formData.latitude && !formData.longitude) || (!formData.latitude && formData.longitude)) issues.push('Enter both latitude and longitude together.')
    if (!formData.zone.trim() && !formData.landmark.trim() && !formData.placeName.trim() && !formData.streetAccess.trim() && !formData.latitude.trim() && !formData.longitude.trim()) {
      issues.push('Provide at least one usable location detail.')
    }
    if (formData.childrenInvolved && Number(formData.childrenCount) < 1) issues.push('Children count must be at least 1.')
    if (formData.elderlyInvolved && Number(formData.elderlyCount) < 1) issues.push('Elderly count must be at least 1.')
    if (formData.disabledSupport && Number(formData.disabledCount) < 1) issues.push('Mobility support count must be at least 1.')
    if (formData.oxygenRequired && Number(formData.oxygenCount) < 1) issues.push('Oxygen count must be at least 1.')
    if (formData.injuriesPresent && Number(formData.injuredCount) < 1) issues.push('Injured count must be at least 1.')
    if (formData.injuriesPresent && !formData.injurySeverity) issues.push('Injury severity is required when injuries are present.')
    if (vulnerableCountTotal > Number(formData.peopleCount)) issues.push('Children, elderly, disabled, and injured counts cannot exceed total people count.')
    if (!formData.confirmationChecked) issues.push('Confirmation is required before submitting.')
    return issues
  }, [formData, vulnerableCountTotal])

  const helperWarning = vulnerableCountTotal > Number(formData.peopleCount)

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const applyDetectedLocation = async (latitude, longitude, fallback = false) => {
    let resolvedFields = {}

    try {
      const reverseGeocodeResponse = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      )

      if (reverseGeocodeResponse.ok) {
        const geoData = await reverseGeocodeResponse.json()
        const address = geoData.address || {}
        resolvedFields = {
          areaType: resolveAreaType(geoData),
          landmark: address.neighbourhood || address.suburb || address.amenity || geoData.name || '',
          placeName: geoData.name || address.building || address.amenity || '',
          streetAccess: formatStreetAccess(address),
          nearbySafeSpot: address.park || address.leisure || '',
        }
      }
    } catch {
      resolvedFields = {}
    }

    setFormData((prev) => ({
      ...prev,
      useCurrentLocation: true,
      latitude: latitude.toFixed(6),
      longitude: longitude.toFixed(6),
      areaType: resolvedFields.areaType || prev.areaType,
      landmark: resolvedFields.landmark || prev.landmark || (fallback ? 'Approximate device location' : 'Detected from device location'),
      placeName: resolvedFields.placeName || prev.placeName,
      streetAccess: resolvedFields.streetAccess || prev.streetAccess,
      nearbySafeSpot: resolvedFields.nearbySafeSpot || prev.nearbySafeSpot,
    }))
    setLocationStatus(
      fallback
        ? 'Using fallback coordinates. You can still refine the location details manually.'
        : 'Current device location detected and location details were auto-filled.'
    )
  }

  const fillCurrentLocation = () => {
    setLocationStatus('')

    if (!navigator.geolocation) {
      applyDetectedLocation(30.2672, -97.7431, true)
      return
    }

    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await applyDetectedLocation(position.coords.latitude, position.coords.longitude)
        setLocating(false)
      },
      async () => {
        await applyDetectedLocation(30.2672, -97.7431, true)
        setLocating(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    )
  }

  const resetForm = () => {
    setFormData(initialFormData)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (validationErrors.length > 0) {
      setError(validationErrors[0])
      return
    }

    setLoading(true)
    try {
      const response = await submitSOS(payload)
      setSubmittedSosId(response.sos_id)
      setMessage('Emergency request received. Responders are being assigned.')
      resetForm()
    } catch (submitError) {
      setError(submitError?.response?.data?.detail || 'Unable to submit the SOS report right now.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="hero-sos">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-kicker text-rose-100">High-priority intake</p>
            <h2 className="mt-2 text-4xl font-black tracking-tight">Emergency SOS</h2>
            <p className="mt-3 max-w-2xl text-sm text-rose-100 sm:text-base">
              Provide critical information. Help will be prioritized automatically and routed to the best available responder team.
            </p>
          </div>
          <div className="grid gap-3 rounded-3xl border border-white bg-white/10 p-4 text-sm">
            <div><span className="font-semibold">Current time:</span> {new Date().toLocaleString()}</div>
            <div><span className="font-semibold">Emergency notice:</span> Dispatch, routing, and assignment systems will use this report immediately.</div>
            <button type="button" className="button-soft bg-white text-slate-900 hover:bg-rose-50" onClick={fillCurrentLocation} disabled={locating}>
              {locating ? 'Detecting Location…' : 'Use Current Location'}
            </button>
            {locationStatus && <div className="text-xs text-rose-100">{locationStatus}</div>}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <section className="panel">
            <p className="section-kicker">Section 1</p>
            <h3 className="panel-title">Incident Details</h3>
            <p className="panel-subtitle">Capture the minimum facts needed to triage safely and route the right responder.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label>
                <span className="text-sm font-semibold text-slate-700">Disaster Type</span>
                <select className="input-shell" value={formData.disasterType} onChange={(e) => handleChange('disasterType', e.target.value)}>
                  {disasterOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-700">Severity</span>
                <select className="input-shell" value={formData.severity} onChange={(e) => handleChange('severity', e.target.value)}>
                  {severityOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-700">People Count</span>
                <input className="input-shell" type="number" min="1" max="500" value={formData.peopleCount} onChange={(e) => handleChange('peopleCount', e.target.value)} />
              </label>
            </div>
            {Number(formData.peopleCount) > 50 && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                Mass casualty detected. Dispatch logic should expect multi-unit response.
              </div>
            )}
          </section>

          <section className="panel">
            <p className="section-kicker">Section 2</p>
            <h3 className="panel-title">Location Accuracy</h3>
            <p className="panel-subtitle">More precise location data improves routing quality and responder access decisions.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label>
                <span className="text-sm font-semibold text-slate-700">Zone</span>
                <input className="input-shell" value={formData.zone} onChange={(e) => handleChange('zone', e.target.value)} placeholder="Zone A, Chicago Loop, River North, etc." />
                <span className="mt-1 block text-xs text-slate-500">Optional. Enter any area name that responders would recognize.</span>
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-700">Sub-location / Area Type</span>
                <select className="input-shell" value={formData.areaType} onChange={(e) => handleChange('areaType', e.target.value)}>
                  {areaTypeOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-700">Landmark</span>
                <input className="input-shell" value={formData.landmark} onChange={(e) => handleChange('landmark', e.target.value)} placeholder="Near school entrance" />
                <span className="mt-1 block text-xs text-slate-500">Use the nearest identifiable landmark.</span>
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-700">Building / Place Name</span>
                <input className="input-shell" value={formData.placeName} onChange={(e) => handleChange('placeName', e.target.value)} placeholder="Sunrise Residency" />
              </label>
              <label className="md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">Street / Access Description</span>
                <input className="input-shell" value={formData.streetAccess} onChange={(e) => handleChange('streetAccess', e.target.value)} placeholder="Back gate entrance, near main road, 2nd floor rear side" />
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-700">Latitude</span>
                <input className="input-shell" value={formData.latitude} onChange={(e) => handleChange('latitude', e.target.value)} placeholder="30.2672" />
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-700">Longitude</span>
                <input className="input-shell" value={formData.longitude} onChange={(e) => handleChange('longitude', e.target.value)} placeholder="-97.7431" />
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-700">Access Difficulty</span>
                <select className="input-shell" value={formData.accessDifficulty} onChange={(e) => handleChange('accessDifficulty', e.target.value)}>
                  {accessDifficultyOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
                <span className="mt-1 block text-xs text-slate-500">Access difficulty helps route the right responder.</span>
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-700">Floor / Elevation</span>
                <select className="input-shell" value={formData.floorLevel} onChange={(e) => handleChange('floorLevel', e.target.value)}>
                  {floorOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
                <span className="mt-1 block text-xs text-slate-500">Enter floor if victims are trapped inside a building.</span>
              </label>
              <label className="md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">Nearby Safe Spot</span>
                <input className="input-shell" value={formData.nearbySafeSpot} onChange={(e) => handleChange('nearbySafeSpot', e.target.value)} placeholder="Terrace, open ground, school courtyard" />
              </label>
            </div>
          </section>

          <section className="panel">
            <p className="section-kicker">Section 3</p>
            <h3 className="panel-title">Medical & Vulnerability</h3>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {[
                ['injuriesPresent', 'Injuries Present'],
                ['oxygenRequired', 'Oxygen Required'],
                ['elderlyInvolved', 'Elderly Involved'],
                ['childrenInvolved', 'Children Involved'],
                ['disabledSupport', 'Disabled / Mobility Support Needed'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={formData[key]} onChange={(e) => handleChange(key, e.target.checked)} />
                  {label}
                </label>
              ))}
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {formData.injuriesPresent && (
                <>
                  <label>
                    <span className="text-sm font-semibold text-slate-700">Number of injured people</span>
                    <input className="input-shell" type="number" min="1" max="500" value={formData.injuredCount} onChange={(e) => handleChange('injuredCount', e.target.value)} />
                  </label>
                  <label>
                    <span className="text-sm font-semibold text-slate-700">Injury Severity</span>
                    <select className="input-shell" value={formData.injurySeverity} onChange={(e) => handleChange('injurySeverity', e.target.value)}>
                      {injurySeverityOptions.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </label>
                </>
              )}
              {formData.oxygenRequired && (
                <label>
                  <span className="text-sm font-semibold text-slate-700">Number requiring oxygen support</span>
                  <input className="input-shell" type="number" min="1" max="500" value={formData.oxygenCount} onChange={(e) => handleChange('oxygenCount', e.target.value)} />
                </label>
              )}
              {formData.childrenInvolved && (
                <label>
                  <span className="text-sm font-semibold text-slate-700">Number of children</span>
                  <input className="input-shell" type="number" min="1" max="500" value={formData.childrenCount} onChange={(e) => handleChange('childrenCount', e.target.value)} />
                </label>
              )}
              {formData.elderlyInvolved && (
                <label>
                  <span className="text-sm font-semibold text-slate-700">Number of elderly people</span>
                  <input className="input-shell" type="number" min="1" max="500" value={formData.elderlyCount} onChange={(e) => handleChange('elderlyCount', e.target.value)} />
                </label>
              )}
              {formData.disabledSupport && (
                <label>
                  <span className="text-sm font-semibold text-slate-700">Number needing mobility support</span>
                  <input className="input-shell" type="number" min="1" max="500" value={formData.disabledCount} onChange={(e) => handleChange('disabledCount', e.target.value)} />
                </label>
              )}
            </div>
            {helperWarning && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Vulnerable-group counts currently exceed the total people count. Please cross-check the report.
              </div>
            )}
          </section>

          <section className="panel">
            <p className="section-kicker">Section 4</p>
            <h3 className="panel-title">Access & Safety Status</h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label>
                <span className="text-sm font-semibold text-slate-700">Trapped Indoors</span>
                <select className="input-shell" value={formData.trappedIndoors} onChange={(e) => handleChange('trappedIndoors', e.target.value)}>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-700">Road Accessibility</span>
                <select className="input-shell" value={formData.roadAccessibility} onChange={(e) => handleChange('roadAccessibility', e.target.value)}>
                  {roadOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-700">Safe Exit Available</span>
                <select className="input-shell" value={formData.safeExitAvailable} onChange={(e) => handleChange('safeExitAvailable', e.target.value)}>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-700">Building Type</span>
                <select className="input-shell" value={formData.buildingType} onChange={(e) => handleChange('buildingType', e.target.value)}>
                  {buildingOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="panel">
            <p className="section-kicker">Section 5</p>
            <h3 className="panel-title">Contact Details</h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label>
                <span className="text-sm font-semibold text-slate-700">Contact Name</span>
                <input className="input-shell" value={formData.contactName} onChange={(e) => handleChange('contactName', e.target.value)} placeholder="John Doe" />
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-700">Phone Number</span>
                <input className="input-shell" value={formData.phoneNumber} onChange={(e) => handleChange('phoneNumber', e.target.value)} placeholder="+123456789" />
              </label>
              <label className="md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">Preferred Language</span>
                <select className="input-shell" value={formData.preferredLanguage} onChange={(e) => handleChange('preferredLanguage', e.target.value)}>
                  {languageOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="panel">
            <p className="section-kicker">Section 6</p>
            <h3 className="panel-title">Additional Information</h3>
            <textarea
              className="input-shell min-h-[140px] resize-y"
              maxLength={500}
              value={formData.additionalNotes}
              onChange={(e) => handleChange('additionalNotes', e.target.value)}
              placeholder="Describe smoke, flooding, blocked exits, visible injuries, or any hazard responders should know before arrival."
            />
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Notes are limited to 500 characters.</span>
              <span>{formData.additionalNotes.length}/500</span>
            </div>
          </section>
        </form>

        <aside className="space-y-6">
          <section className="panel">
            <p className="section-kicker">Review</p>
            <h3 className="panel-title">Review your emergency report</h3>
            <div className="mt-5 space-y-4 rounded-[22px] border border-rose-100 bg-[linear-gradient(180deg,#fff3f2_0%,#ffffff_100%)] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">Disaster Type</p>
                  <p className="text-lg font-bold text-slate-950">{formData.disasterType}</p>
                </div>
                <span className={`badge ${formData.severity === 'Critical' ? 'badge-critical' : formData.severity === 'High' ? 'badge-high' : formData.severity === 'Medium' ? 'badge-medium' : 'badge-low'}`}>
                  {formData.severity}
                </span>
              </div>
                <div>
                  <p className="text-sm text-slate-500">Location</p>
                <p className="text-base font-semibold text-slate-900">{formData.zone || 'Not provided yet'}</p>
                <p className="mt-1 text-sm text-slate-500">{formData.areaType} • {formData.placeName || formData.landmark || 'No place reference yet'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-sm text-slate-500">People Count</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{formData.peopleCount}</p>
                </div>
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-sm text-slate-500">Access Difficulty</p>
                  <p className="mt-1 text-lg font-black text-slate-950">{formData.accessDifficulty}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-500">Critical Needs</p>
                {criticalNeeds.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {criticalNeeds.map((need) => <span key={need} className="badge badge-high">{need}</span>)}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">No explicit critical needs flagged.</p>
                )}
              </div>
            </div>

            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={formData.confirmationChecked} onChange={(e) => handleChange('confirmationChecked', e.target.checked)} />
              <span>I confirm this information is correct.</span>
            </label>

            {validationErrors.length > 0 && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {validationErrors[0]}
              </div>
            )}

            <button type="submit" onClick={handleSubmit} disabled={loading || validationErrors.length > 0} className="button-danger mt-5 w-full text-lg">
              {loading ? 'Submitting…' : '🚨 Send SOS'}
            </button>

            {message && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-800 flex flex-col gap-3">
                <p>{message}</p>
                {submittedSosId && (
                  <Link to={`/victim/${submittedSosId}`} className="button-primary text-center bg-emerald-600 hover:bg-emerald-700 text-white w-full rounded-[16px] py-3 text-sm font-bold uppercase tracking-wide">
                    View Live Rescue Status
                  </Link>
                )}
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                {error}
              </div>
            )}
          </section>

          <section className="panel">
            <p className="section-kicker">Payload</p>
            <h3 className="panel-title">Structured SOS output</h3>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(payload, null, 2)}</pre>
          </section>
        </aside>
      </div>
    </div>
  )
}

export default SOSForm
