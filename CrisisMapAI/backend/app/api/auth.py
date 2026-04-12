from datetime import datetime
from typing import Any, Dict, Literal
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..auth.security import generate_otp_code, hash_password, otp_expiry, verify_password
from ..db.postgres import RegistrationRepository


router = APIRouter()
repository = RegistrationRepository()


class PasswordLoginRequest(BaseModel):
    role: Literal["victim", "organization", "responder"]
    login_identifier: str
    password: str = Field(min_length=8)


class OtpRequest(BaseModel):
    role: Literal["victim", "responder"]
    login_identifier: str


class OtpVerifyRequest(BaseModel):
    role: Literal["victim", "responder"]
    login_identifier: str
    otp_code: str = Field(min_length=6, max_length=6)


class ProfileUpdateRequest(BaseModel):
    role: Literal["victim", "organization", "responder"]
    subject_id: str
    profile_data: Dict[str, Any]


def _session_payload(account: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "session_id": str(uuid.uuid4()),
        "role": account["role"],
        "subject_id": account["subject_id"],
        "login_identifier": account["login_identifier"],
        "logged_in_at": datetime.utcnow().isoformat(),
    }


@router.post("/auth/login")
async def login_with_password(request: PasswordLoginRequest):
    account = repository.get_auth_account(request.role, request.login_identifier)
    if not account or not verify_password(request.password, account["password_hash"], account["password_salt"]):
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    return _session_payload(account)


@router.post("/auth/otp/request")
async def request_otp(request: OtpRequest):
    account = repository.get_auth_account(request.role, request.login_identifier)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found.")
    if not account.get("otp_enabled"):
        raise HTTPException(status_code=400, detail="OTP login is not enabled for this account.")
    code = generate_otp_code()
    otp = repository.create_otp(request.role, request.login_identifier, code, otp_expiry().isoformat())
    return {
        "message": "OTP generated.",
        "delivery": "development_preview",
        "otp_preview": otp["otp_code"],
    }


@router.post("/auth/otp/verify")
async def verify_otp(request: OtpVerifyRequest):
    otp = repository.consume_valid_otp(request.role, request.login_identifier, request.otp_code)
    if not otp:
        raise HTTPException(status_code=401, detail="Invalid or expired OTP.")
    account = repository.get_auth_account(request.role, request.login_identifier)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found.")
    return _session_payload(account)


@router.get("/profiles/{role}/{subject_id}")
async def get_profile(role: str, subject_id: str):
    profile = repository.get_profile(role, subject_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return profile


@router.put("/profiles")
async def update_profile(request: ProfileUpdateRequest):
    profile = repository.update_profile_data(request.role, request.subject_id, request.profile_data)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return profile
