import React, { useEffect, useMemo, useState } from 'react'
import RegistrationStepLayout from './RegistrationStepLayout'
import ZoneMapPicker from './ZoneMapPicker'
import {
  expireResponderCertifications,
  getRegistrationDraft,
  getRegistrationZones,
  saveRegistrationDraft,
  saveResponderRegistration,
  validateOrganizationCode,
} from '../api/client'

const draftStorageKey = 'crisismap_responder_registration_draft'
const totalSteps = 6
const phonePattern = /^\+?[0-9\s().-]{7,20}$/
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const organizationTypeOptions = [
  'Ambulance Service',
  'Fire Department',
  'Police / Law Enforcement',
  'Search & Rescue',
  'NGO / Volunteer Organization',
  'Hospital Emergency Unit',
  'Disaster Relief Unit',
  'Other',
]

const primaryRoleOptions = [
  'Ambulance Driver',
  'Paramedic',
  'Firefighter',
  'Rescue Operator',
  'Incident Commander',
  'Volunteer',
  'Shelter Coordinator',
  'Medical Staff',
  'Logistics Staff',
  'Boat Operator',
  'Helicopter Operator',
  'Other',
]

const responseCategoryOptions = [
  'Medical',
  'Fire',
  'Evacuation',
  'Search & Rescue',
  'Shelter Support',
  'Supply Distribution',
  'Elderly Assistance',
  'Child Support',
  'Language Support',
]

const shiftTypeOptions = ['Day', 'Night', 'Rotational', 'On-call']
const skillOptions = [
  'Basic First Aid',
  'Advanced Life Support',
  'CPR',
  'Trauma Support',
  'Oxygen Administration',
  'Fire Suppression',
  'Rope Rescue',
  'Flood Rescue',
  'Debris Search',
  'Crowd Management',
  'Shelter Operations',
  'Mental Health Support',
  'Language Translation',
]
const medicalCapabilityOptions = ['Oxygen Support', 'Ventilator Support', 'Pediatric Response', 'Burn Support', 'Cardiac Emergency']
const languageOptions = ['English', 'Spanish', 'Hindi', 'Telugu', 'Arabic', 'Other']
const vehicleTypeOptions = ['Ambulance', 'Fire Truck', 'Rescue Van', 'Boat', 'Helicopter', 'Supply Truck', 'Bike', 'Other']
const equipmentOptions = ['Oxygen Cylinder', 'Stretcher', 'Defibrillator', 'Trauma Kit', 'Fire Extinguisher', 'Rope Kit', 'Megaphone', 'Food Supplies', 'Medical Supplies', 'Child Rescue Kit']
const routeConstraintOptions = ['Narrow roads only', 'Water rescue capable', 'High-speed capable', 'Off-road capable']
const availabilityOptions = ['Available', 'Busy', 'Off Duty', 'On Standby']
const disasterTypeOptions = ['Fire', 'Flood', 'Earthquake', 'Storm', 'Medical', 'General Rescue']
const contactMethodOptions = ['Phone Call', 'SMS', 'App Notification', 'Radio']
const genderOptions = ['Female', 'Male', 'Non-binary', 'Prefer not to say']
const governmentIdTypeOptions = ['Driver License', 'National ID', 'Passport', 'Other']
const verificationStatusOptions = ['pending', 'verified', 'rejected', 'needs_review']

const emptyCertification = () => ({
  certification_name: '',
  certification_number: '',
  expiry_date: '',
  proof_url: '',
})

const initialState = {
  currentStep: 1,
  draftId: '',
  organization: {
    code: '',
    name: '',
    type: organizationTypeOptions[0],
    branch_name: '',
    branch_id: '',
    official_email: '',
    contact_number: '',
    verification_status: 'pending',
    verified_record: null,
  },
  personal: {
    full_name: '',
    responder_id: '',
    date_of_birth: '',
    gender: '',
    government_id_type: governmentIdTypeOptions[0],
    government_id_number: '',
    profile_photo_url: '',
  },
  role: {
    primary_role: primaryRoleOptions[0],
    secondary_role: '',
    response_categories: [],
    experience_years: 0,
    rank: 'Field Responder',
    shift_type: shiftTypeOptions[0],
    shelter_operations_experience: '',
  },
  skills: {
    capabilities: [],
    certifications: [emptyCertification()],
    special_medical_capabilities: [],
    languages: ['English'],
  },
  vehicle: {
    assigned: false,
    assigned_vehicle_id: '',
    vehicle_type: '',
    registration_number: '',
    capacity: 1,
    equipment: [],
    operational_status: 'Ready',
    driver_license_type: '',
    route_constraints: [],
  },
  coverage: {
    base_zone: '',
    coverage_zones: [],
    availability: 'Available',
    shift_start: '',
    shift_end: '',
    max_response_radius_km: 25,
    outside_zone_allowed: false,
    location_sharing: false,
    preferred_disaster_types: [],
  },
  contact: {
    mobile: '',
    backup_contact: '',
    radio_call_sign: '',
    preferred_contact_method: contactMethodOptions[0],
    emergency_contact_name: '',
    emergency_contact_number: '',
  },
  verification: {
    government_id_url: '',
    organization_badge_url: '',
    certification_proof_url: '',
    driver_license_url: '',
    medical_license_url: '',
    status: 'pending',
    background_check_completed: false,
    supervisor_approval: false,
  },
  account: {
    username: '',
    password: '',
    confirm_password: '',
    terms_acknowledged: false,
    data_sharing_consent: false,
    dispatch_location_consent: false,
    accurate_information_confirmation: false,
  },
}

const ResponderRegistrationFlow = ({ onBackToRoles }) => {
  const [formState, setFormState] = useState(initialState)
  const [zones, setZones] = useState([])
  const [screenLoading, setScreenLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resumeDraft, setResumeDraft] = useState(null)
  const [completed, setCompleted] = useState(null)
  const [validationRequested, setValidationRequested] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        setZones(await getRegistrationZones())
        const savedDraftId = window.localStorage.getItem(draftStorageKey)
        if (savedDraftId) {
          setResumeDraft(await getRegistrationDraft('responder', savedDraftId))
        }
      } catch (loadError) {
        console.error(loadError)
      } finally {
        setScreenLoading(false)
      }
    }
    loadData()
  }, [])

  useEffect(() => {
    if (screenLoading || completed) return undefined
    const hasData = JSON.stringify(formState) !== JSON.stringify(initialState)
    if (!hasData) return undefined

    const timer = window.setTimeout(() => {
      saveRegistrationDraft({
        role: 'responder',
        current_step: formState.currentStep,
        draft_data: buildResponderPayload(formState),
        draft_id: formState.draftId || undefined,
      })
        .then((draft) => {
          window.localStorage.setItem(draftStorageKey, draft.id)
          setFormState((prev) => (prev.draftId === draft.id ? prev : { ...prev, draftId: draft.id }))
        })
        .catch((draftError) => console.error('Responder autosave failed:', draftError))
    }, 700)

    return () => window.clearTimeout(timer)
  }, [formState, screenLoading, completed])

  useEffect(() => {
    setValidationRequested(false)
  }, [formState.currentStep])

  const derivedFlags = useMemo(() => deriveFlags(formState), [formState])
  const currentErrors = useMemo(() => validateStep(formState, derivedFlags), [formState, derivedFlags])
  const canContinue = Object.keys(currentErrors).length === 0

  const updateSection = (section, field, value) => {
    setFormState((prev) => ({ ...prev, [section]: { ...prev[section], [field]: value } }))
  }

  const toggleArray = (section, field, value) => {
    setFormState((prev) => {
      const current = prev[section][field]
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
        },
      }
    })
  }

  const updateCertification = (index, field, value) => {
    setFormState((prev) => {
      const next = [...prev.skills.certifications]
      next[index] = { ...next[index], [field]: value }
      return { ...prev, skills: { ...prev.skills, certifications: next } }
    })
  }

  const addCertification = () => setFormState((prev) => ({ ...prev, skills: { ...prev.skills, certifications: [...prev.skills.certifications, emptyCertification()] } }))
  const removeCertification = (index) => setFormState((prev) => ({ ...prev, skills: { ...prev.skills, certifications: prev.skills.certifications.filter((_, certIndex) => certIndex !== index) } }))

  const verifyOrganization = async () => {
    setLoading(true)
    setError('')
    try {
      const verified = await validateOrganizationCode(formState.organization.code)
      await expireResponderCertifications()
      setFormState((prev) => ({
        ...prev,
        organization: {
          ...prev.organization,
          name: verified.name || prev.organization.name,
          verification_status: verified.organization_code_active ? 'verified' : 'needs_review',
          verified_record: verified,
        },
        vehicle: {
          ...prev.vehicle,
          assigned_vehicle_id: prev.vehicle.assigned_vehicle_id || '',
        },
      }))
    } catch (verifyError) {
      setFormState((prev) => ({
        ...prev,
        organization: { ...prev.organization, verification_status: 'rejected', verified_record: null },
      }))
      setError(verifyError?.response?.data?.detail || 'Organization code not found or not yet approved.')
    } finally {
      setLoading(false)
    }
  }

  const persistDraft = async () => {
    const draft = await saveRegistrationDraft({
      role: 'responder',
      current_step: formState.currentStep,
      draft_data: buildResponderPayload(formState),
      draft_id: formState.draftId || undefined,
    })
    window.localStorage.setItem(draftStorageKey, draft.id)
    setFormState((prev) => ({ ...prev, draftId: draft.id }))
  }

  const handleContinue = async () => {
    setError('')
    if (!canContinue) {
      setValidationRequested(true)
      return
    }

    setLoading(true)
    try {
      if (formState.currentStep < totalSteps) {
        await persistDraft()
        setFormState((prev) => ({ ...prev, currentStep: prev.currentStep + 1 }))
      } else {
        const result = await saveResponderRegistration({
          draft_id: formState.draftId || undefined,
          current_step: totalSteps,
          ...buildResponderPayload(formState),
        })
        window.localStorage.setItem(draftStorageKey, result.draft.id)
        setCompleted(result)
      }
    } catch (submitError) {
      setError(submitError?.response?.data?.detail || 'Unable to save responder registration right now.')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = async () => {
    setError('')
    if (formState.currentStep === 1) {
      onBackToRoles()
      return
    }
    await persistDraft()
    setFormState((prev) => ({ ...prev, currentStep: prev.currentStep - 1 }))
  }

  const handleSaveDraft = async () => {
    setLoading(true)
    setError('')
    try {
      await persistDraft()
    } catch (draftError) {
      setError(draftError?.response?.data?.detail || 'Unable to save draft right now.')
    } finally {
      setLoading(false)
    }
  }

  const restoreDraft = () => {
    if (!resumeDraft?.draft_data) return
    const draftData = resumeDraft.draft_data
    setFormState({
      ...initialState,
      draftId: resumeDraft.id,
      currentStep: Math.min(resumeDraft.current_step || 1, totalSteps),
      ...draftData,
      organization: {
        ...initialState.organization,
        ...(draftData.organization || {}),
      },
      personal: {
        ...initialState.personal,
        ...(draftData.personal || {}),
      },
      role: {
        ...initialState.role,
        ...(draftData.role || {}),
      },
      skills: {
        ...initialState.skills,
        ...(draftData.skills || {}),
        certifications: (draftData.skills?.certifications || initialState.skills.certifications),
      },
      vehicle: {
        ...initialState.vehicle,
        ...(draftData.vehicle || {}),
      },
      coverage: {
        ...initialState.coverage,
        ...(draftData.coverage || {}),
      },
      contact: {
        ...initialState.contact,
        ...(draftData.contact || {}),
      },
      verification: {
        ...initialState.verification,
        ...(draftData.verification || {}),
      },
      account: {
        ...initialState.account,
        ...(draftData.account || {}),
      },
    })
    setResumeDraft(null)
  }

  const discardDraft = () => {
    window.localStorage.removeItem(draftStorageKey)
    setResumeDraft(null)
    setFormState(initialState)
  }

  if (screenLoading) {
    return <div className="panel py-16 text-center text-slate-500">Loading responder registration…</div>
  }

  if (completed) {
    return (
      <section className="panel space-y-4">
        <p className="section-kicker">Responder onboarded</p>
        <h2 className="panel-title mt-2">Responder registration submitted</h2>
        <p className="panel-subtitle">The responder profile is now stored for dispatch trust, routing, assignment, and verification workflows.</p>
        <div className="rounded-[22px] bg-emerald-50 p-4 text-sm text-emerald-800">
          Review status: <span className="font-bold capitalize">{formState.verification.status.replace('_', ' ')}</span>
        </div>
        <button type="button" className="button-primary" onClick={onBackToRoles}>Return to Role Selection</button>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      {resumeDraft && (
        <section className="panel border-rose-100 bg-rose-50/70">
          <p className="section-kicker">Draft found</p>
          <h3 className="panel-title mt-2">Continue responder onboarding?</h3>
          <p className="panel-subtitle">We found a saved responder application. You can continue where you left off or start fresh.</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button type="button" className="button-primary" onClick={restoreDraft}>Continue draft</button>
            <button type="button" className="button-soft" onClick={discardDraft}>Start over</button>
          </div>
        </section>
      )}

      <RegistrationStepLayout
        title={stepTitles[formState.currentStep]}
        subtitle={stepSubtitles[formState.currentStep]}
        currentStep={formState.currentStep}
        totalSteps={totalSteps}
        onBack={handleBack}
        onContinue={handleContinue}
        continueLabel={formState.currentStep === totalSteps ? 'Submit Registration' : 'Continue'}
        continueDisabled={loading}
        canContinue={canContinue}
        loading={loading}
        onExtraAction={handleSaveDraft}
        extraActionLabel="Save Draft"
        extraActionDisabled={loading}
      >
        {formState.currentStep === 1 && (
          <div className="space-y-6">
            <SectionCard title="Organization Verification" description="Verify the responder’s organization before activating assignment, routing, or vehicle trust in the system.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Organization Code" required error={showError(validationRequested, currentErrors.organization_code)}>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input className="input-shell flex-1" value={formState.organization.code} onChange={(e) => updateSection('organization', 'code', e.target.value.toUpperCase())} placeholder="ORG-ABC123" />
                    <button type="button" className="button-primary whitespace-nowrap" onClick={verifyOrganization} disabled={!formState.organization.code || loading}>Verify Organization Code</button>
                  </div>
                </Field>
                <Field label="Verification Status" required>
                  <div className={verificationStatusClass(formState.organization.verification_status)}>
                    {formatStatus(formState.organization.verification_status)}
                  </div>
                </Field>
                <Field label="Organization Name" required error={showError(validationRequested, currentErrors.organization_name)}>
                  <input className="input-shell" value={formState.organization.name} onChange={(e) => updateSection('organization', 'name', e.target.value)} />
                </Field>
                <Field label="Organization Type" required error={showError(validationRequested, currentErrors.organization_type)}>
                  <select className="input-shell" value={formState.organization.type} onChange={(e) => updateSection('organization', 'type', e.target.value)}>
                    {organizationTypeOptions.map((option) => <option key={option}>{option}</option>)}
                  </select>
                </Field>
                <Field label="Branch / Station Name" required error={showError(validationRequested, currentErrors.branch_name)}>
                  <input className="input-shell" value={formState.organization.branch_name} onChange={(e) => updateSection('organization', 'branch_name', e.target.value)} />
                </Field>
                <Field label="Branch / Station ID" required error={showError(validationRequested, currentErrors.branch_id)}>
                  <input className="input-shell" value={formState.organization.branch_id} onChange={(e) => updateSection('organization', 'branch_id', e.target.value)} />
                </Field>
                <Field label="Official Work Email" required error={showError(validationRequested, currentErrors.official_email)}>
                  <input className="input-shell" type="email" value={formState.organization.official_email} onChange={(e) => updateSection('organization', 'official_email', e.target.value)} placeholder="responder@agency.org" />
                </Field>
                <Field label="Organization Contact Number" required error={showError(validationRequested, currentErrors.organization_contact_number)}>
                  <input className="input-shell" value={formState.organization.contact_number} onChange={(e) => updateSection('organization', 'contact_number', e.target.value)} placeholder="+1 555 123 9999" />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Personal Information" description="Capture the responder identity that appears to coordinators, route planners, and verification reviewers.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field className="md:col-span-2" label="Full Name" required error={showError(validationRequested, currentErrors.full_name)}>
                  <input className="input-shell" value={formState.personal.full_name} onChange={(e) => updateSection('personal', 'full_name', e.target.value)} />
                </Field>
                <Field label={derivedFlags.isVolunteer ? 'Responder ID / Employee ID (optional for volunteers)' : 'Responder ID / Employee ID'} required={!derivedFlags.isVolunteer} error={showError(validationRequested, currentErrors.responder_id)}>
                  <input className="input-shell" value={formState.personal.responder_id} onChange={(e) => updateSection('personal', 'responder_id', e.target.value)} />
                </Field>
                <Field label="Date of Birth" required error={showError(validationRequested, currentErrors.date_of_birth)}>
                  <input className="input-shell" type="date" value={formState.personal.date_of_birth} onChange={(e) => updateSection('personal', 'date_of_birth', e.target.value)} />
                </Field>
                <Field label="Gender">
                  <select className="input-shell" value={formState.personal.gender} onChange={(e) => updateSection('personal', 'gender', e.target.value)}>
                    <option value="">Optional</option>
                    {genderOptions.map((option) => <option key={option}>{option}</option>)}
                  </select>
                </Field>
                <Field label="Government ID Type" required error={showError(validationRequested, currentErrors.government_id_type)}>
                  <select className="input-shell" value={formState.personal.government_id_type} onChange={(e) => updateSection('personal', 'government_id_type', e.target.value)}>
                    {governmentIdTypeOptions.map((option) => <option key={option}>{option}</option>)}
                  </select>
                </Field>
                <Field label="Government ID Number" required error={showError(validationRequested, currentErrors.government_id_number)}>
                  <input className="input-shell" value={formState.personal.government_id_number} onChange={(e) => updateSection('personal', 'government_id_number', e.target.value)} />
                </Field>
                <Field label="Profile Photo Upload URL" required error={showError(validationRequested, currentErrors.profile_photo_url)}>
                  <input className="input-shell" value={formState.personal.profile_photo_url} onChange={(e) => updateSection('personal', 'profile_photo_url', e.target.value)} placeholder="Secure asset URL or object key" />
                </Field>
              </div>
            </SectionCard>
          </div>
        )}

        {formState.currentStep === 2 && (
          <div className="space-y-6">
            <SectionCard title="Role & Response Type" description="Define the operational role used for dispatch logic, responder trust, and incident assignment.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Primary Role" required error={showError(validationRequested, currentErrors.primary_role)}>
                  <select className="input-shell" value={formState.role.primary_role} onChange={(e) => updateSection('role', 'primary_role', e.target.value)}>
                    {primaryRoleOptions.map((option) => <option key={option}>{option}</option>)}
                  </select>
                </Field>
                <Field label="Secondary Role">
                  <input className="input-shell" value={formState.role.secondary_role} onChange={(e) => updateSection('role', 'secondary_role', e.target.value)} />
                </Field>
                <Field className="md:col-span-2" label="Response Category" required error={showError(validationRequested, currentErrors.response_categories)}>
                  <ChipGroup options={responseCategoryOptions} selected={formState.role.response_categories} onToggle={(value) => toggleArray('role', 'response_categories', value)} />
                </Field>
                <Field label="Years of Experience">
                  <input className="input-shell" type="number" min="0" value={formState.role.experience_years} onChange={(e) => updateSection('role', 'experience_years', Number(e.target.value))} />
                </Field>
                <Field label="Rank / Level">
                  <input className="input-shell" value={formState.role.rank} onChange={(e) => updateSection('role', 'rank', e.target.value)} />
                </Field>
                <Field label="Shift Type">
                  <select className="input-shell" value={formState.role.shift_type} onChange={(e) => updateSection('role', 'shift_type', e.target.value)}>
                    {shiftTypeOptions.map((option) => <option key={option}>{option}</option>)}
                  </select>
                </Field>
                {derivedFlags.needsShelterExperience && (
                  <Field label="Shelter Operations Experience" required error={showError(validationRequested, currentErrors.shelter_experience)}>
                    <textarea className="input-shell min-h-[100px]" value={formState.role.shelter_operations_experience} onChange={(e) => updateSection('role', 'shelter_operations_experience', e.target.value)} placeholder="Describe shelter intake, family support, bed allocation, or camp operations experience." />
                  </Field>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Skills, Training & Certifications" description="These capabilities feed capability-aware responder assignment and help the system avoid unsafe deployments.">
              <Field label="Skills" required error={showError(validationRequested, currentErrors.skills)}>
                <ChipGroup options={skillOptions} selected={formState.skills.capabilities} onToggle={(value) => toggleArray('skills', 'capabilities', value)} />
              </Field>
              <Field label="Special Medical Capability">
                <ChipGroup options={medicalCapabilityOptions} selected={formState.skills.special_medical_capabilities} onToggle={(value) => toggleArray('skills', 'special_medical_capabilities', value)} />
              </Field>
              <Field label="Languages Spoken" required error={showError(validationRequested, currentErrors.languages)}>
                <ChipGroup options={languageOptions} selected={formState.skills.languages} onToggle={(value) => toggleArray('skills', 'languages', value)} />
              </Field>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Certifications</p>
                  <button type="button" className="button-soft" onClick={addCertification}>Add Certification</button>
                </div>
                {formState.skills.certifications.map((certification, index) => (
                  <div key={`cert-${index}`} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="font-semibold text-slate-800">Certification {index + 1}</p>
                      {formState.skills.certifications.length > 1 && <button type="button" className="text-sm font-semibold text-rose-600" onClick={() => removeCertification(index)}>Remove</button>}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Certification Name">
                        <input className="input-shell" value={certification.certification_name} onChange={(e) => updateCertification(index, 'certification_name', e.target.value)} placeholder="ALS, EMT, Swift Water Rescue" />
                      </Field>
                      <Field label="Certification Number">
                        <input className="input-shell" value={certification.certification_number} onChange={(e) => updateCertification(index, 'certification_number', e.target.value)} />
                      </Field>
                      <Field label="Expiry Date">
                        <input className="input-shell" type="date" value={certification.expiry_date} onChange={(e) => updateCertification(index, 'expiry_date', e.target.value)} />
                      </Field>
                      <Field label="Proof URL">
                        <input className="input-shell" value={certification.proof_url} onChange={(e) => updateCertification(index, 'proof_url', e.target.value)} placeholder="Secure proof upload URL or object key" />
                      </Field>
                    </div>
                  </div>
                ))}
                {showError(validationRequested, currentErrors.certifications) && <InlineError message={currentErrors.certifications} />}
              </div>
            </SectionCard>
          </div>
        )}

        {formState.currentStep === 3 && (
          <div className="space-y-6">
            <SectionCard title="Vehicle / Equipment Details" description="Vehicle readiness and route constraints are required for routing, deployment fit, and trust scoring.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Vehicle Assigned?" required error={showError(validationRequested, currentErrors.vehicle_assigned)}>
                  <select className="input-shell" value={String(formState.vehicle.assigned)} onChange={(e) => updateSection('vehicle', 'assigned', e.target.value === 'true')}>
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </Field>
                {derivedFlags.showVehicleSection && (
                  <Field label="Assigned Organization Vehicle">
                    <select className="input-shell" value={formState.vehicle.assigned_vehicle_id} onChange={(e) => updateSection('vehicle', 'assigned_vehicle_id', e.target.value)}>
                      <option value="">Select existing vehicle if available</option>
                      {(formState.organization.verified_record?.vehicles || []).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicle_type} - {vehicle.vehicle_identifier}</option>)}
                    </select>
                  </Field>
                )}
                {derivedFlags.showVehicleSection && (
                  <>
                    <Field label="Vehicle Type" required error={showError(validationRequested, currentErrors.vehicle_type)}>
                      <select className="input-shell" value={formState.vehicle.vehicle_type} onChange={(e) => updateSection('vehicle', 'vehicle_type', e.target.value)}>
                        <option value="">Select vehicle type</option>
                        {vehicleTypeOptions.map((option) => <option key={option}>{option}</option>)}
                      </select>
                    </Field>
                    <Field label="Vehicle Registration Number" required error={showError(validationRequested, currentErrors.vehicle_registration)}>
                      <input className="input-shell" value={formState.vehicle.registration_number} onChange={(e) => updateSection('vehicle', 'registration_number', e.target.value)} />
                    </Field>
                    <Field label="Vehicle Capacity">
                      <input className="input-shell" type="number" min="1" value={formState.vehicle.capacity} onChange={(e) => updateSection('vehicle', 'capacity', Number(e.target.value))} />
                    </Field>
                    <Field label="Fuel / Operational Status">
                      <select className="input-shell" value={formState.vehicle.operational_status} onChange={(e) => updateSection('vehicle', 'operational_status', e.target.value)}>
                        <option>Ready</option>
                        <option>Low Fuel</option>
                        <option>Maintenance Needed</option>
                        <option>Not Available</option>
                      </select>
                    </Field>
                    <Field label="Driver License Type / Permit Type" required={derivedFlags.requiresDriverLicense} error={showError(validationRequested, currentErrors.driver_license_type)}>
                      <input className="input-shell" value={formState.vehicle.driver_license_type} onChange={(e) => updateSection('vehicle', 'driver_license_type', e.target.value)} />
                    </Field>
                    <Field className="md:col-span-2" label="Equipment Available">
                      <ChipGroup options={equipmentOptions} selected={formState.vehicle.equipment} onToggle={(value) => toggleArray('vehicle', 'equipment', value)} />
                    </Field>
                    <Field className="md:col-span-2" label="Route Constraints">
                      <ChipGroup options={routeConstraintOptions} selected={formState.vehicle.route_constraints} onToggle={(value) => toggleArray('vehicle', 'route_constraints', value)} />
                    </Field>
                  </>
                )}
                {!derivedFlags.showVehicleSection && (
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 md:col-span-2">
                    This responder role does not require transport registration by default. Vehicle fields remain optional unless command assigns mobile transport duties.
                  </div>
                )}
              </div>
            </SectionCard>
          </div>
        )}

        {formState.currentStep === 4 && (
          <div className="space-y-6">
            <SectionCard title="Availability & Coverage Area" description="Coverage, response radius, and live location consent determine where and when the responder can be safely dispatched.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Current Base Zone" required error={showError(validationRequested, currentErrors.base_zone)}>
                  <div className="mt-2"><ZoneMapPicker zones={zones} selectedZones={formState.coverage.base_zone ? [formState.coverage.base_zone] : []} onToggleZone={(zoneId) => updateSection('coverage', 'base_zone', zoneId)} /></div>
                </Field>
                <Field label="Coverage Zones" required error={showError(validationRequested, currentErrors.coverage_zones)}>
                  <div className="mt-2"><ZoneMapPicker zones={zones} selectedZones={formState.coverage.coverage_zones} onToggleZone={(zoneId) => toggleArray('coverage', 'coverage_zones', zoneId)} multiSelect accent="#0f766e" secondaryAccent="#134e4a" /></div>
                </Field>
                <Field label="Current Availability" required error={showError(validationRequested, currentErrors.availability)}>
                  <select className="input-shell" value={formState.coverage.availability} onChange={(e) => updateSection('coverage', 'availability', e.target.value)}>
                    {availabilityOptions.map((option) => <option key={option}>{option}</option>)}
                  </select>
                </Field>
                <Field label="Shift Start Time" required={formState.coverage.availability === 'Available'} error={showError(validationRequested, currentErrors.shift_start)}>
                  <input className="input-shell" type="time" value={formState.coverage.shift_start} onChange={(e) => updateSection('coverage', 'shift_start', e.target.value)} />
                </Field>
                <Field label="Shift End Time" required={formState.coverage.availability === 'Available'} error={showError(validationRequested, currentErrors.shift_end)}>
                  <input className="input-shell" type="time" value={formState.coverage.shift_end} onChange={(e) => updateSection('coverage', 'shift_end', e.target.value)} />
                </Field>
                <Field label="Max Response Radius (km)">
                  <input className="input-shell" type="range" min="5" max="100" value={formState.coverage.max_response_radius_km} onChange={(e) => updateSection('coverage', 'max_response_radius_km', Number(e.target.value))} />
                  <p className="mt-2 text-sm text-slate-500">{formState.coverage.max_response_radius_km} km</p>
                </Field>
                <Field label="Can Travel Outside Base Zone?">
                  <select className="input-shell" value={String(formState.coverage.outside_zone_allowed)} onChange={(e) => updateSection('coverage', 'outside_zone_allowed', e.target.value === 'true')}>
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </Field>
                <Field label="Real-time Location Sharing Consent" required error={showError(validationRequested, currentErrors.location_sharing)}>
                  <select className="input-shell" value={String(formState.coverage.location_sharing)} onChange={(e) => updateSection('coverage', 'location_sharing', e.target.value === 'true')}>
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </Field>
                <Field className="md:col-span-2" label="Preferred Disaster Types">
                  <ChipGroup options={disasterTypeOptions} selected={formState.coverage.preferred_disaster_types} onToggle={(value) => toggleArray('coverage', 'preferred_disaster_types', value)} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Contact & Emergency Reachability" description="Dispatch must have a reliable primary contact path and a fallback contact for high-stakes coordination.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Mobile Number" required error={showError(validationRequested, currentErrors.mobile)}>
                  <input className="input-shell" value={formState.contact.mobile} onChange={(e) => updateSection('contact', 'mobile', e.target.value)} placeholder="+1 555 222 1111" />
                </Field>
                <Field label="Backup Contact Number">
                  <input className="input-shell" value={formState.contact.backup_contact} onChange={(e) => updateSection('contact', 'backup_contact', e.target.value)} placeholder="+1 555 888 7777" />
                </Field>
                <Field label="Radio Call Sign">
                  <input className="input-shell" value={formState.contact.radio_call_sign} onChange={(e) => updateSection('contact', 'radio_call_sign', e.target.value)} />
                </Field>
                <Field label="Preferred Contact Method" required error={showError(validationRequested, currentErrors.contact_method)}>
                  <select className="input-shell" value={formState.contact.preferred_contact_method} onChange={(e) => updateSection('contact', 'preferred_contact_method', e.target.value)}>
                    {contactMethodOptions.map((option) => <option key={option}>{option}</option>)}
                  </select>
                </Field>
                <Field label="Emergency Contact Person" required error={showError(validationRequested, currentErrors.emergency_contact_name)}>
                  <input className="input-shell" value={formState.contact.emergency_contact_name} onChange={(e) => updateSection('contact', 'emergency_contact_name', e.target.value)} />
                </Field>
                <Field label="Emergency Contact Number" required error={showError(validationRequested, currentErrors.emergency_contact_number)}>
                  <input className="input-shell" value={formState.contact.emergency_contact_number} onChange={(e) => updateSection('contact', 'emergency_contact_number', e.target.value)} />
                </Field>
              </div>
            </SectionCard>
          </div>
        )}

        {formState.currentStep === 5 && (
          <div className="space-y-6">
            <SectionCard title="Identity / Trust Verification" description="These artifacts support responder trust verification before the system uses this profile for real incident coordination.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Upload Government ID" required error={showError(validationRequested, currentErrors.government_id_url)}>
                  <input className="input-shell" value={formState.verification.government_id_url} onChange={(e) => updateSection('verification', 'government_id_url', e.target.value)} placeholder="Secure upload URL or object key" />
                </Field>
                <Field label="Upload Organization Badge / ID Card" required error={showError(validationRequested, currentErrors.organization_badge_url)}>
                  <input className="input-shell" value={formState.verification.organization_badge_url} onChange={(e) => updateSection('verification', 'organization_badge_url', e.target.value)} placeholder="Secure upload URL or object key" />
                </Field>
                <Field label="Upload Certification Proof" required={derivedFlags.needsCertificationProof} error={showError(validationRequested, currentErrors.certification_proof_url)}>
                  <input className="input-shell" value={formState.verification.certification_proof_url} onChange={(e) => updateSection('verification', 'certification_proof_url', e.target.value)} placeholder="Secure upload URL or object key" />
                </Field>
                {derivedFlags.requiresDriverLicense && (
                  <Field label="Upload Driver License" required error={showError(validationRequested, currentErrors.driver_license_url)}>
                    <input className="input-shell" value={formState.verification.driver_license_url} onChange={(e) => updateSection('verification', 'driver_license_url', e.target.value)} placeholder="Secure upload URL or object key" />
                  </Field>
                )}
                {derivedFlags.requiresMedicalLicense && (
                  <Field label="Upload Medical License" required error={showError(validationRequested, currentErrors.medical_license_url)}>
                    <input className="input-shell" value={formState.verification.medical_license_url} onChange={(e) => updateSection('verification', 'medical_license_url', e.target.value)} placeholder="Secure upload URL or object key" />
                  </Field>
                )}
                <Field label="Verification Status">
                  <select className="input-shell" value={formState.verification.status} onChange={(e) => updateSection('verification', 'status', e.target.value)}>
                    {verificationStatusOptions.map((option) => <option key={option} value={option}>{formatStatus(option)}</option>)}
                  </select>
                </Field>
                <Field label="Background check completed?">
                  <select className="input-shell" value={String(formState.verification.background_check_completed)} onChange={(e) => updateSection('verification', 'background_check_completed', e.target.value === 'true')}>
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </Field>
                <Field label="Supervisor approval">
                  <select className="input-shell" value={String(formState.verification.supervisor_approval)} onChange={(e) => updateSection('verification', 'supervisor_approval', e.target.value === 'true')}>
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Account & Security" description="This account is what CrisisMap AI will use to authenticate the responder for secure incident coordination.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Username" required error={showError(validationRequested, currentErrors.username)}>
                  <input className="input-shell" value={formState.account.username} onChange={(e) => updateSection('account', 'username', e.target.value)} />
                </Field>
                <Field label="Password" required error={showError(validationRequested, currentErrors.password)}>
                  <input className="input-shell" type="password" value={formState.account.password} onChange={(e) => updateSection('account', 'password', e.target.value)} />
                </Field>
                <Field label="Confirm Password" required error={showError(validationRequested, currentErrors.confirm_password)}>
                  <input className="input-shell" type="password" value={formState.account.confirm_password} onChange={(e) => updateSection('account', 'confirm_password', e.target.value)} />
                </Field>
              </div>
              <div className="mt-4 grid gap-3">
                {[
                  ['terms_acknowledged', 'I acknowledge the responder platform terms and secure operations policy.', 'terms_acknowledged'],
                  ['data_sharing_consent', 'I consent to operational data sharing for emergency coordination.', 'data_sharing_consent'],
                  ['dispatch_location_consent', 'I consent to location sharing when used for dispatch and responder safety.', 'dispatch_location_consent'],
                ].map(([field, label, errorKey]) => (
                  <label key={field} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={formState.account[field]} onChange={(e) => updateSection('account', field, e.target.checked)} />
                      <span>{label}</span>
                    </div>
                    {showError(validationRequested, currentErrors[errorKey]) && <InlineError className="mt-2" message={currentErrors[errorKey]} />}
                  </label>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {formState.currentStep === 6 && (
          <div className="space-y-6">
            <SectionCard title="Review & Submit" description="Review the structured responder registration before submitting it into CrisisMap AI dispatch and trust workflows.">
              <div className="grid gap-4 md:grid-cols-2">
                <ReviewItem label="Name" value={formState.personal.full_name} />
                <ReviewItem label="Organization" value={`${formState.organization.name} (${formState.organization.code})`} />
                <ReviewItem label="Role" value={formState.role.primary_role} />
                <ReviewItem label="Skills" value={joinList(formState.skills.capabilities)} />
                <ReviewItem label="Vehicle Type" value={formState.vehicle.assigned ? formState.vehicle.vehicle_type : 'No assigned vehicle'} />
                <ReviewItem label="Base Zone" value={zoneName(zones, formState.coverage.base_zone)} />
                <ReviewItem label="Availability" value={formState.coverage.availability} />
                <ReviewItem label="Contact" value={formState.contact.mobile} />
                <ReviewItem label="Verification Uploads" value={verificationSummary(formState, derivedFlags)} />
              </div>
              <label className="mt-4 block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700">
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={formState.account.accurate_information_confirmation} onChange={(e) => updateSection('account', 'accurate_information_confirmation', e.target.checked)} />
                  <span>I confirm the information provided is accurate and may be used for emergency coordination.</span>
                </div>
                {showError(validationRequested, currentErrors.accurate_information_confirmation) && <InlineError className="mt-2" message={currentErrors.accurate_information_confirmation} />}
              </label>
            </SectionCard>
          </div>
        )}

        {error && <div className="mt-5 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      </RegistrationStepLayout>
    </div>
  )
}

const SectionCard = ({ title, description, children }) => (
  <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">{title}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
    <div className="space-y-4">{children}</div>
  </section>
)

const Field = ({ label, required, error, className = '', children }) => (
  <label className={className}>
    <span className="text-sm font-semibold text-slate-700">{label} {required ? <span className="badge badge-critical">Required</span> : null}</span>
    <div className="mt-2">{children}</div>
    {error && <InlineError className="mt-2" message={error} />}
  </label>
)

const InlineError = ({ message, className = '' }) => (
  <p className={`text-sm text-rose-600 ${className}`.trim()}>{message}</p>
)

const ChipGroup = ({ options, selected, onToggle }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((option) => {
      const active = selected.includes(option)
      return (
        <button key={option} type="button" className={active ? 'badge badge-high' : 'badge border border-slate-200 bg-white text-slate-600'} onClick={() => onToggle(option)}>
          {option}
        </button>
      )
    })}
  </div>
)

const ReviewItem = ({ label, value }) => (
  <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
    <p className="mt-2 text-sm font-medium text-slate-700">{value || 'Not provided'}</p>
  </div>
)

const deriveFlags = (state) => {
  const primaryRole = state.role.primary_role
  const lowerRole = primaryRole.toLowerCase()
  return {
    isVolunteer: primaryRole === 'Volunteer',
    showVehicleSection: ['Ambulance Driver', 'Firefighter', 'Rescue Operator', 'Logistics Staff', 'Boat Operator', 'Helicopter Operator'].includes(primaryRole) || state.vehicle.assigned,
    requiresDriverLicense: ['Ambulance Driver', 'Boat Operator', 'Helicopter Operator'].includes(primaryRole),
    requiresMedicalLicense: ['Paramedic', 'Medical Staff'].includes(primaryRole),
    needsShelterExperience: primaryRole === 'Shelter Coordinator',
    needsCertificationProof: ['Paramedic', 'Medical Staff', 'Firefighter', 'Rescue Operator', 'Boat Operator', 'Helicopter Operator'].includes(primaryRole) || state.skills.certifications.some((cert) => cert.certification_name || cert.certification_number),
    needsSpecialTransportCertification: ['Boat Operator', 'Helicopter Operator'].includes(primaryRole),
    isMedicalResponder: lowerRole.includes('medical') || primaryRole === 'Paramedic',
  }
}

const validateStep = (state, flags) => {
  switch (state.currentStep) {
    case 1:
      return validateStepOne(state, flags)
    case 2:
      return validateStepTwo(state, flags)
    case 3:
      return validateStepThree(state, flags)
    case 4:
      return validateStepFour(state)
    case 5:
      return validateStepFive(state, flags)
    case 6:
      return validateStepSix(state)
    default:
      return {}
  }
}

const validateStepOne = (state, flags) => {
  const errors = {}
  if (!state.organization.code.trim()) errors.organization_code = 'Organization code is required.'
  if (!state.organization.name.trim()) errors.organization_name = 'Organization name is required.'
  if (!state.organization.type) errors.organization_type = 'Organization type is required.'
  if (!state.organization.branch_name.trim()) errors.branch_name = 'Branch or station name is required.'
  if (!state.organization.branch_id.trim()) errors.branch_id = 'Branch or station ID is required.'
  if (!emailPattern.test(state.organization.official_email.trim())) errors.official_email = 'Enter a valid official work email.'
  if (!phonePattern.test(state.organization.contact_number.trim())) errors.organization_contact_number = 'Enter a valid organization contact number.'
  if (!state.personal.full_name.trim()) errors.full_name = 'Full name is required.'
  if (!flags.isVolunteer && !state.personal.responder_id.trim()) errors.responder_id = 'Responder or employee ID is required.'
  if (!state.personal.date_of_birth) errors.date_of_birth = 'Date of birth is required.'
  if (!state.personal.government_id_type) errors.government_id_type = 'Government ID type is required.'
  if (!state.personal.government_id_number.trim()) errors.government_id_number = 'Government ID number is required.'
  if (!state.personal.profile_photo_url.trim()) errors.profile_photo_url = 'Profile photo upload is required.'
  return errors
}

const validateStepTwo = (state, flags) => {
  const errors = {}
  if (!state.role.primary_role) errors.primary_role = 'Primary role is required.'
  if (state.role.response_categories.length === 0) errors.response_categories = 'Select at least one response category.'
  if (state.skills.capabilities.length === 0) errors.skills = 'Select at least one skill.'
  if (state.skills.languages.length === 0) errors.languages = 'Select at least one language.'
  if (flags.needsShelterExperience && !state.role.shelter_operations_experience.trim()) errors.shelter_experience = 'Shelter coordinators must describe shelter operations experience.'

  const certifications = state.skills.certifications.filter((cert) => cert.certification_name || cert.certification_number || cert.expiry_date || cert.proof_url)
  const missingCriticalExpiry = certifications.some((cert) => cert.certification_name && !cert.expiry_date)
  const missingCriticalProof = flags.needsSpecialTransportCertification && certifications.some((cert) => cert.certification_name && !cert.proof_url)

  if ((flags.requiresMedicalLicense || flags.needsSpecialTransportCertification) && certifications.length === 0) {
    errors.certifications = 'Add at least one role-appropriate certification.'
  } else if (missingCriticalExpiry) {
    errors.certifications = 'Critical certifications require expiry dates.'
  } else if (missingCriticalProof) {
    errors.certifications = 'Special transport certifications require proof URLs.'
  }

  return errors
}

const validateStepThree = (state, flags) => {
  const errors = {}
  if (flags.showVehicleSection && !state.vehicle.assigned) {
    errors.vehicle_assigned = 'This responder role requires vehicle assignment details.'
  }
  if (flags.showVehicleSection && state.vehicle.assigned) {
    if (!state.vehicle.vehicle_type) errors.vehicle_type = 'Vehicle type is required when a vehicle is assigned.'
    if (!state.vehicle.registration_number.trim()) errors.vehicle_registration = 'Vehicle registration number is required.'
    if (flags.requiresDriverLicense && !state.vehicle.driver_license_type.trim()) errors.driver_license_type = 'Driver or permit type is required for this role.'
  }
  return errors
}

const validateStepFour = (state) => {
  const errors = {}
  if (!state.coverage.base_zone) errors.base_zone = 'Select a base zone.'
  if (state.coverage.coverage_zones.length === 0) errors.coverage_zones = 'Select at least one coverage zone.'
  if (!state.coverage.availability) errors.availability = 'Availability is required.'
  if (state.coverage.availability === 'Available' && !state.coverage.shift_start) errors.shift_start = 'Shift start time is required when available.'
  if (state.coverage.availability === 'Available' && !state.coverage.shift_end) errors.shift_end = 'Shift end time is required when available.'
  if (!state.coverage.location_sharing) errors.location_sharing = 'Location sharing consent is required for dispatch use.'
  if (!phonePattern.test(state.contact.mobile.trim())) errors.mobile = 'Enter a valid mobile number.'
  if (!state.contact.preferred_contact_method) errors.contact_method = 'Preferred contact method is required.'
  if (!state.contact.emergency_contact_name.trim()) errors.emergency_contact_name = 'Emergency contact person is required.'
  if (!phonePattern.test(state.contact.emergency_contact_number.trim())) errors.emergency_contact_number = 'Enter a valid emergency contact number.'
  return errors
}

const validateStepFive = (state, flags) => {
  const errors = {}
  if (!state.verification.government_id_url.trim()) errors.government_id_url = 'Government ID upload is required.'
  if (!state.verification.organization_badge_url.trim()) errors.organization_badge_url = 'Organization badge upload is required.'
  if (flags.needsCertificationProof && !state.verification.certification_proof_url.trim()) errors.certification_proof_url = 'Certification proof is required for this responder role.'
  if (flags.requiresDriverLicense && !state.verification.driver_license_url.trim()) errors.driver_license_url = 'Driver license upload is required.'
  if (flags.requiresMedicalLicense && !state.verification.medical_license_url.trim()) errors.medical_license_url = 'Medical license upload is required.'
  if (!state.account.username.trim()) errors.username = 'Username is required.'
  if ((state.account.password || '').length < 8) errors.password = 'Password must be at least 8 characters.'
  if (state.account.password !== state.account.confirm_password) errors.confirm_password = 'Passwords must match.'
  if (!state.account.terms_acknowledged) errors.terms_acknowledged = 'You must acknowledge the terms.'
  if (!state.account.data_sharing_consent) errors.data_sharing_consent = 'Data sharing consent is required.'
  if (!state.account.dispatch_location_consent) errors.dispatch_location_consent = 'Dispatch location consent is required.'
  return errors
}

const validateStepSix = (state) => {
  const errors = {}
  if (!state.account.accurate_information_confirmation) errors.accurate_information_confirmation = 'Confirm that the registration information is accurate before submitting.'
  return errors
}

const buildResponderPayload = (state) => ({
  organization: {
    code: state.organization.code.trim(),
    name: state.organization.name.trim(),
    type: state.organization.type,
    branch_name: state.organization.branch_name.trim(),
    branch_id: state.organization.branch_id.trim(),
    official_email: state.organization.official_email.trim(),
    contact_number: state.organization.contact_number.trim(),
    verification_status: state.organization.verification_status,
  },
  personal: {
    full_name: state.personal.full_name.trim(),
    responder_id: normalizeOptionalText(state.personal.responder_id),
    date_of_birth: state.personal.date_of_birth || null,
    gender: normalizeOptionalText(state.personal.gender),
    government_id_type: state.personal.government_id_type,
    government_id_number: state.personal.government_id_number.trim(),
    profile_photo_url: state.personal.profile_photo_url.trim(),
  },
  role: {
    primary_role: state.role.primary_role,
    secondary_role: normalizeOptionalText(state.role.secondary_role),
    response_categories: state.role.response_categories,
    experience_years: state.role.experience_years,
    rank: state.role.rank.trim(),
    shift_type: state.role.shift_type,
    shelter_operations_experience: normalizeOptionalText(state.role.shelter_operations_experience),
  },
  skills: {
    capabilities: state.skills.capabilities,
    certifications: state.skills.certifications.filter((cert) => cert.certification_name || cert.certification_number || cert.expiry_date || cert.proof_url).map((cert) => ({
      certification_name: normalizeOptionalText(cert.certification_name),
      certification_number: normalizeOptionalText(cert.certification_number),
      expiry_date: cert.expiry_date || null,
      proof_url: normalizeOptionalText(cert.proof_url),
    })),
    special_medical_capabilities: state.skills.special_medical_capabilities,
    languages: state.skills.languages,
  },
  vehicle: {
    assigned: state.vehicle.assigned,
    assigned_vehicle_id: normalizeOptionalText(state.vehicle.assigned_vehicle_id),
    vehicle_type: normalizeOptionalText(state.vehicle.vehicle_type),
    registration_number: normalizeOptionalText(state.vehicle.registration_number),
    capacity: state.vehicle.capacity,
    equipment: state.vehicle.equipment,
    operational_status: state.vehicle.operational_status,
    driver_license_type: normalizeOptionalText(state.vehicle.driver_license_type),
    route_constraints: state.vehicle.route_constraints,
  },
  coverage: {
    base_zone: state.coverage.base_zone,
    coverage_zones: state.coverage.coverage_zones,
    availability: state.coverage.availability,
    shift_start: normalizeOptionalText(state.coverage.shift_start),
    shift_end: normalizeOptionalText(state.coverage.shift_end),
    max_response_radius_km: state.coverage.max_response_radius_km,
    outside_zone_allowed: state.coverage.outside_zone_allowed,
    location_sharing: state.coverage.location_sharing,
    preferred_disaster_types: state.coverage.preferred_disaster_types,
  },
  contact: {
    mobile: state.contact.mobile.trim(),
    backup_contact: normalizeOptionalText(state.contact.backup_contact),
    radio_call_sign: normalizeOptionalText(state.contact.radio_call_sign),
    preferred_contact_method: state.contact.preferred_contact_method,
    emergency_contact_name: state.contact.emergency_contact_name.trim(),
    emergency_contact_number: state.contact.emergency_contact_number.trim(),
  },
  verification: {
    government_id_url: state.verification.government_id_url.trim(),
    organization_badge_url: state.verification.organization_badge_url.trim(),
    certification_proof_url: normalizeOptionalText(state.verification.certification_proof_url),
    driver_license_url: normalizeOptionalText(state.verification.driver_license_url),
    medical_license_url: normalizeOptionalText(state.verification.medical_license_url),
    status: state.verification.status,
    background_check_completed: state.verification.background_check_completed,
    supervisor_approval: state.verification.supervisor_approval,
  },
  account: {
    username: state.account.username.trim(),
    password: state.account.password,
    terms_acknowledged: state.account.terms_acknowledged,
    data_sharing_consent: state.account.data_sharing_consent,
    dispatch_location_consent: state.account.dispatch_location_consent,
  },
})

const normalizeOptionalText = (value) => {
  const trimmed = typeof value === 'string' ? value.trim() : value
  return trimmed ? trimmed : null
}

const showError = (visible, message) => (visible ? message : '')
const formatStatus = (value) => value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
const joinList = (values) => values?.length ? values.join(', ') : 'Not provided'
const zoneName = (zones, zoneId) => zones.find((zone) => zone.id === zoneId)?.name || zoneId || 'Not provided'
const verificationSummary = (state, flags) => {
  const uploads = [
    state.verification.government_id_url && 'Government ID',
    state.verification.organization_badge_url && 'Organization Badge',
    state.verification.certification_proof_url && 'Certification Proof',
    flags.requiresDriverLicense && state.verification.driver_license_url && 'Driver License',
    flags.requiresMedicalLicense && state.verification.medical_license_url && 'Medical License',
  ].filter(Boolean)
  return uploads.length ? uploads.join(', ') : 'No uploads attached'
}

const verificationStatusClass = (status) => {
  if (status === 'verified') return 'rounded-[18px] bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700'
  if (status === 'rejected') return 'rounded-[18px] bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700'
  return 'rounded-[18px] bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700'
}

const stepTitles = {
  1: 'Responder Registration — Organization and Identity',
  2: 'Responder Registration — Role, Skills, and Certifications',
  3: 'Responder Registration — Vehicle and Equipment Readiness',
  4: 'Responder Registration — Coverage and Reachability',
  5: 'Responder Registration — Trust Verification and Security',
  6: 'Responder Registration — Review and Submit',
}

const stepSubtitles = {
  1: 'Verify organizational trust and capture the responder identity that the system uses for assignment confidence.',
  2: 'Document operational roles, capabilities, and certifications needed for skill-aware dispatch.',
  3: 'Add transport and field equipment details when the responder role affects routing or vehicle utilization.',
  4: 'Set live availability, coverage zones, and contact pathways for real emergency dispatch decisions.',
  5: 'Attach verification artifacts and create the secure account that unlocks trusted responder access.',
  6: 'Review the complete structured profile before submitting it into the CrisisMap AI responder graph.',
}

export default ResponderRegistrationFlow
