import axios from 'axios'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
export const SOCKET_BASE_URL = import.meta.env.VITE_SOCKET_BASE_URL || API_BASE_URL

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const normalizeIncident = (incident = {}) => ({
  ...incident,
  severity: incident.severity || incident.inferred_severity || 'medium',
  status: incident.status || 'received',
  people_count: incident.people_count ?? 1,
  note: incident.note || incident.notes || '',
  case_trace: incident.case_trace || incident.algorithm_results?.case_trace || {},
  messages: incident.messages || incident.algorithm_results?.messages || {},
  location_resolution: incident.location_resolution || incident.incident_data?.location_resolution || null,
  responder: typeof incident.responder === 'object' ? incident.responder?.name : (incident.responder || incident.assigned_responder?.name || incident.assignment?.responder_name || incident.assignment?.responder?.name || null),
})

export const submitSOS = async (sosData) => {
  const response = await apiClient.post('/api/sos', sosData)
  return response.data
}

export const getIncidents = async () => {
  const response = await apiClient.get('/api/incidents')
  return (response.data || []).map(normalizeIncident)
}

export const getDashboardData = async () => {
  const response = await apiClient.get('/api/dashboard')
  const data = response.data || {}
  return {
    ...data,
    recentIncidents: (data.recentIncidents || []).map(normalizeIncident),
  }
}

export const getIncidentDetails = async (sosId) => {
  const response = await apiClient.get(`/api/incidents/${sosId}`)
  return normalizeIncident(response.data || {})
}

export const getVictimIncidents = async (victimId) => {
  const response = await apiClient.get(`/api/victims/${victimId}/incidents`)
  return (response.data || []).map(normalizeIncident)
}

export const getRegistrationZones = async () => {
  const response = await apiClient.get('/api/registration/zones')
  return response.data || []
}

export const saveRegistrationDraft = async (payload) => {
  const response = await apiClient.post('/api/registration/drafts', payload)
  return response.data
}

export const getRegistrationDraft = async (role, draftId) => {
  const response = await apiClient.get(`/api/registration/drafts/${role}/${draftId}`)
  return response.data
}

export const saveVictimTier1 = async (payload) => {
  const response = await apiClient.post('/api/registration/victim/tier1', payload)
  return response.data
}

export const saveVictimTier2 = async (payload) => {
  const response = await apiClient.post('/api/registration/victim/tier2', payload)
  return response.data
}

export const saveOrganizationRegistration = async (payload) => {
  const response = await apiClient.post('/api/registration/organization', payload)
  return response.data
}

export const approveOrganization = async (organizationId) => {
  const response = await apiClient.post(`/api/registration/organization/${organizationId}/approve`)
  return response.data
}

export const validateOrganizationCode = async (organizationCode) => {
  const response = await apiClient.get(`/api/registration/organization-code/${organizationCode}`)
  return response.data
}

export const saveResponderRegistration = async (payload) => {
  const response = await apiClient.post('/api/registration/responder', payload)
  return response.data
}

export const expireResponderCertifications = async () => {
  const response = await apiClient.post('/api/registration/responder/certifications/expire-check')
  return response.data
}

export const loginWithPassword = async (payload) => {
  const response = await apiClient.post('/api/auth/login', payload)
  return response.data
}

export const requestOtp = async (payload) => {
  const response = await apiClient.post('/api/auth/otp/request', payload)
  return response.data
}

export const verifyOtp = async (payload) => {
  const response = await apiClient.post('/api/auth/otp/verify', payload)
  return response.data
}

export const getProfile = async (role, subjectId) => {
  const response = await apiClient.get(`/api/profiles/${role}/${subjectId}`)
  return response.data
}

export const updateProfile = async (payload) => {
  const response = await apiClient.put('/api/profiles', payload)
  return response.data
}
