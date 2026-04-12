from datetime import datetime
import os
from typing import Any, Dict, Optional

import requests
import streamlit as st

from backend.app.models.schemas import SOSRequest


API_URL = os.getenv("CRISISMAP_API_URL", "http://localhost:8000/api/sos")

DISASTER_TYPES = [
    "Fire",
    "Flood",
    "Earthquake",
    "Storm",
    "Landslide",
    "Medical Emergency",
]
SEVERITY_LEVELS = ["Low", "Medium", "High", "Critical"]
INJURY_LEVELS = ["Minor", "Moderate", "Severe", "Critical"]
ROAD_OPTIONS = ["Clear", "Blocked", "Unknown"]
BUILDING_TYPES = ["Apartment", "House", "Road", "Public Building", "Industrial"]
LANGUAGES = ["English", "Spanish", "Hindi", "Telugu", "Other"]


def init_state() -> None:
    defaults = {
        "mock_gps": "Unavailable",
        "submit_message": None,
        "submit_error": None,
        "last_payload": None,
    }
    for key, value in defaults.items():
        st.session_state.setdefault(key, value)


def use_current_location() -> None:
    st.session_state.mock_gps = "30.2672, -97.7431 (Mock GPS)"


def build_payload(photo_name: Optional[str]) -> Dict[str, Any]:
    return {
        "incident_id": f"SOS_{datetime.utcnow().strftime('%H%M%S')}",
        "timestamp": datetime.utcnow().isoformat(),
        "disaster_type": st.session_state.disaster_type.lower(),
        "location": {
            "zone": st.session_state.zone,
            "landmark": st.session_state.landmark or None,
            "gps": st.session_state.mock_gps if st.session_state.mock_gps != "Unavailable" else st.session_state.gps or None,
        },
        "severity": st.session_state.severity.lower(),
        "people_count": int(st.session_state.people_count),
        "medical": {
            "injuries": st.session_state.injuries_present,
            "injury_severity": st.session_state.injury_severity.lower() if st.session_state.injuries_present else None,
            "oxygen_required": st.session_state.oxygen_required,
            "oxygen_count": int(st.session_state.oxygen_count) if st.session_state.oxygen_required else None,
            "elderly": st.session_state.elderly_involved,
            "children": st.session_state.children_involved,
            "disabled": st.session_state.disabled_support,
        },
        "access": {
            "trapped": st.session_state.trapped_indoors == "Yes",
            "road_status": st.session_state.road_accessibility.lower(),
            "safe_exit": st.session_state.safe_exit_available == "Yes",
            "building_type": st.session_state.building_type.lower(),
        },
        "contact": {
            "name": st.session_state.contact_name or None,
            "phone": st.session_state.phone_number or None,
            "language": st.session_state.preferred_language,
        },
        "notes": st.session_state.additional_notes or None,
        "photo_filename": photo_name,
    }


def render_summary(payload: Dict[str, Any]) -> None:
    medical = payload["medical"]
    access = payload["access"]
    needs = []
    if medical["injuries"]:
        needs.append(f"Injuries: {medical['injury_severity']}")
    if medical["oxygen_required"]:
        needs.append(f"Oxygen x{medical['oxygen_count']}")
    if medical["elderly"]:
        needs.append("Elderly support")
    if medical["children"]:
        needs.append("Children involved")
    if medical["disabled"]:
        needs.append("Mobility support")
    if access["trapped"]:
        needs.append("Trapped indoors")
    if access["road_status"] == "blocked":
        needs.append("Road blocked")

    with st.container():
        st.markdown("### Review your emergency report")
        st.markdown(
            f"""
            <div class="summary-card">
                <div><strong>Disaster Type:</strong> {payload['disaster_type'].title()}</div>
                <div><strong>Location:</strong> {payload['location']['zone']}</div>
                <div><strong>Severity:</strong> {payload['severity'].title()}</div>
                <div><strong>People Count:</strong> {payload['people_count']}</div>
                <div><strong>Critical Needs:</strong> {", ".join(needs) if needs else "None reported"}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )


def submit_payload(payload: Dict[str, Any]) -> None:
    try:
        validated = SOSRequest.model_validate(payload)
        st.session_state.last_payload = validated.model_dump(mode="json")
        response = requests.post(API_URL, json=validated.model_dump(mode="json"), timeout=20)
        response.raise_for_status()
        st.session_state.submit_error = None
        st.session_state.submit_message = "Emergency request received. Responders are being assigned."
    except Exception as exc:  # broad to keep the emergency UI resilient
        st.session_state.submit_message = None
        st.session_state.submit_error = str(exc)


def main() -> None:
    st.set_page_config(page_title="CrisisMap Emergency SOS", page_icon="🚨", layout="wide")
    init_state()

    st.markdown(
        """
        <style>
        .stApp {
            background:
                radial-gradient(circle at top, rgba(220, 38, 38, 0.16), transparent 32%),
                linear-gradient(180deg, #fff7f7 0%, #f6f7fb 100%);
        }
        .emergency-shell {
            background: rgba(255, 255, 255, 0.92);
            border: 1px solid rgba(239, 68, 68, 0.18);
            border-radius: 24px;
            padding: 1.5rem 1.5rem 2rem;
            box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
        }
        .hero-card {
            background: linear-gradient(135deg, #991b1b 0%, #dc2626 70%, #f97316 100%);
            color: white;
            border-radius: 22px;
            padding: 1.4rem 1.6rem;
            margin-bottom: 1rem;
            box-shadow: 0 20px 45px rgba(153, 27, 27, 0.28);
        }
        .notice-strip {
            background: rgba(255,255,255,0.16);
            border: 1px solid rgba(255,255,255,0.18);
            border-radius: 14px;
            padding: 0.8rem 1rem;
            margin-top: 1rem;
        }
        .section-card {
            background: #ffffff;
            border: 1px solid #fee2e2;
            border-radius: 18px;
            padding: 1rem 1rem 0.75rem;
            box-shadow: 0 10px 25px rgba(15, 23, 42, 0.04);
            margin-bottom: 1rem;
        }
        .summary-card {
            background: linear-gradient(180deg, #fff1f2 0%, #ffffff 100%);
            border: 1px solid #fecdd3;
            border-radius: 18px;
            padding: 1rem;
            display: grid;
            gap: 0.5rem;
            margin-bottom: 0.75rem;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )

    st.markdown('<div class="emergency-shell">', unsafe_allow_html=True)

    with st.container():
        st.markdown(
            f"""
            <div class="hero-card">
                <div style="font-size:2rem; font-weight:800;">🚨 Emergency SOS</div>
                <div style="font-size:1rem; margin-top:0.35rem;">Provide critical information. Help will be prioritized automatically.</div>
                <div class="notice-strip">
                    <div><strong>Current time:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</div>
                    <div><strong>Emergency notice:</strong> Dispatch, routing, and assignment systems will use this report immediately after submission.</div>
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
        top_left, top_right = st.columns([2, 1])
        with top_left:
            st.info(f"Current location signal: {st.session_state.mock_gps}")
        with top_right:
            st.button("Use Current Location", on_click=use_current_location, use_container_width=True)

    with st.container():
        left, right = st.columns([1.25, 0.95], gap="large")

        with left:
            st.markdown('<div class="section-card">', unsafe_allow_html=True)
            st.markdown("### Incident Details")
            incident_col_1, incident_col_2 = st.columns(2)
            with incident_col_1:
                st.selectbox("Disaster Type", DISASTER_TYPES, key="disaster_type")
            with incident_col_2:
                st.selectbox("Severity", SEVERITY_LEVELS, index=1, key="severity")
            st.text_input("Zone / Location", key="zone", placeholder="Zone A")
            detail_col_1, detail_col_2 = st.columns(2)
            with detail_col_1:
                st.text_input("Landmark", key="landmark", placeholder="Near School")
            with detail_col_2:
                st.text_input("GPS Placeholder", key="gps", placeholder="30.2672, -97.7431")
            st.number_input("People Count", min_value=1, max_value=500, step=1, key="people_count", value=1)
            if int(st.session_state.people_count) > 50:
                st.warning("Mass casualty detected")
            st.markdown("</div>", unsafe_allow_html=True)

            st.markdown('<div class="section-card">', unsafe_allow_html=True)
            st.markdown("### Medical & Vulnerability")
            med_col_1, med_col_2 = st.columns(2)
            with med_col_1:
                st.checkbox("Injuries Present", key="injuries_present")
                st.checkbox("Oxygen Required", key="oxygen_required")
                st.checkbox("Elderly Involved", key="elderly_involved")
            with med_col_2:
                st.checkbox("Children Involved", key="children_involved")
                st.checkbox("Disabled / Mobility Support Needed", key="disabled_support")

            if st.session_state.injuries_present or st.session_state.oxygen_required:
                with st.expander("Critical care details", expanded=True):
                    if st.session_state.injuries_present:
                        st.selectbox("Injury Severity", INJURY_LEVELS, key="injury_severity")
                    if st.session_state.oxygen_required:
                        st.number_input("Number needing oxygen", min_value=1, max_value=500, step=1, key="oxygen_count", value=1)
            st.markdown("</div>", unsafe_allow_html=True)

            st.markdown('<div class="section-card">', unsafe_allow_html=True)
            st.markdown("### Access & Safety Status")
            access_col_1, access_col_2 = st.columns(2)
            with access_col_1:
                st.radio("Trapped Indoors", ["Yes", "No"], key="trapped_indoors", horizontal=True)
                st.selectbox("Road Accessibility", ROAD_OPTIONS, key="road_accessibility")
            with access_col_2:
                st.radio("Safe Exit Available", ["Yes", "No"], key="safe_exit_available", horizontal=True)
                st.selectbox("Building Type", BUILDING_TYPES, key="building_type")
            st.markdown("</div>", unsafe_allow_html=True)

            st.markdown('<div class="section-card">', unsafe_allow_html=True)
            st.markdown("### Contact Details")
            contact_col_1, contact_col_2 = st.columns(2)
            with contact_col_1:
                st.text_input("Contact Name", key="contact_name", placeholder="John Doe")
                st.text_input("Phone Number", key="phone_number", placeholder="+123456789")
            with contact_col_2:
                st.selectbox("Preferred Language", LANGUAGES, key="preferred_language")
            st.markdown("</div>", unsafe_allow_html=True)

            st.markdown('<div class="section-card">', unsafe_allow_html=True)
            st.markdown("### Additional Information")
            st.text_area(
                "Additional Notes",
                key="additional_notes",
                placeholder="Heavy smoke inside building. Stairwell blocked.",
                max_chars=500,
                height=120,
            )
            photo = st.file_uploader("Photo Upload", type=["png", "jpg", "jpeg"], help="Optional. Mock upload is acceptable for now.")
            st.markdown("</div>", unsafe_allow_html=True)

        with right:
            st.markdown('<div class="section-card">', unsafe_allow_html=True)
            st.markdown("### Review Summary")
            payload = build_payload(photo.name if photo else None)
            render_summary(payload)
            st.checkbox("I confirm this information is correct", key="confirm_information")
            with st.expander("Payload preview", expanded=False):
                st.json(payload)
            st.markdown("</div>", unsafe_allow_html=True)

            st.markdown('<div class="section-card">', unsafe_allow_html=True)
            st.markdown("### Submit Action")
            disabled = not st.session_state.confirm_information
            if st.button("🚨 Send SOS", type="primary", use_container_width=True, disabled=disabled):
                submit_payload(payload)

            if st.session_state.submit_message:
                st.success(st.session_state.submit_message)
            if st.session_state.submit_error:
                st.error(f"Submission failed: {st.session_state.submit_error}")
            st.caption(f"Backend target: {API_URL}")
            st.markdown("</div>", unsafe_allow_html=True)

    st.markdown("</div>", unsafe_allow_html=True)


if __name__ == "__main__":
    main()
