import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PASSWORD_SPECIAL_PATTERN = re.compile(r"[^A-Za-z0-9]")


def normalize_email(value: str) -> str:
    return value.strip().lower()


def validate_password_strength(value: str, *, field_name: str = "Password") -> str:
    if len(value) < 8:
        raise ValueError(f"{field_name} must be at least 8 characters.")
    if not any(char.isupper() for char in value):
        raise ValueError(f"{field_name} must contain at least one uppercase letter.")
    if not any(char.islower() for char in value):
        raise ValueError(f"{field_name} must contain at least one lowercase letter.")
    if not any(char.isdigit() for char in value):
        raise ValueError(f"{field_name} must contain at least one number.")
    if not PASSWORD_SPECIAL_PATTERN.search(value):
        raise ValueError(f"{field_name} must contain at least one special character.")
    return value


class EmailRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        email = normalize_email(value)
        if not EMAIL_PATTERN.fullmatch(email):
            raise ValueError("Invalid email format.")
        return email


class VerifyEmailRequest(EmailRequest):
    otp_code: str = Field(..., min_length=6, max_length=6)

    @field_validator("otp_code")
    @classmethod
    def validate_otp(cls, value: str) -> str:
        if not value.isdigit() or len(value) != 6:
            raise ValueError("OTP must be exactly 6 digits.")
        return value


class RegisterRequest(EmailRequest):
    full_name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        full_name = value.strip()
        if not full_name:
            raise ValueError("Full name is required.")
        return full_name

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)

    @field_validator("confirm_password")
    @classmethod
    def validate_confirm_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Confirm password must be at least 8 characters.")
        return value


class MessageResponse(BaseModel):
    message: str


class VerifyEmailResponse(MessageResponse):
    verified: bool


class LoginRequest(EmailRequest):
    password: str = Field(..., min_length=1)


class LoginUserResponse(BaseModel):
    user_id: str
    full_name: str
    email: str
    role: str

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    user: LoginUserResponse


class VerifyResetCodeRequest(EmailRequest):
    code: str = Field(..., min_length=6, max_length=6)

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        if not value.isdigit() or len(value) != 6:
            raise ValueError("Code must be exactly 6 digits.")
        return value


class ResetPasswordRequest(EmailRequest):
    password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)

    @model_validator(mode="after")
    def validate_password_match(self) -> "ResetPasswordRequest":
        if self.password != self.confirm_password:
            raise ValueError("Confirm password mismatch.")
        return self


class UserResponse(BaseModel):
    user_id: str
    full_name: str
    email: str
    status_user: str
    role: str
    avatar_url: str | None
    is_verified: bool | None
    failed_login_attempts: int | None
    locked_until: datetime | None
    last_login: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RegisterResponse(MessageResponse):
    user: UserResponse
    access_token: str
    refresh_token: str
