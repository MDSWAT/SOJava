import hashlib
import logging
import os
from typing import Any, Dict

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi import Request
from ldap3 import ALL, Connection, NTLM, Server
from ldap3.core.exceptions import LDAPBindError, LDAPSocketOpenError, LDAPStartTLSError
from passlib.utils import md4
from pydantic import BaseModel

# --- Enable MD4 hashing for NTLM (same trick as in the provided Python example) ---
_original_new = hashlib.new


def new_hashlib_with_md4(name: str, data: bytes = b""):
    if name.lower() == "md4":
        h = md4.md4()
        h.update(data)
        return h
    return _original_new(name, data)


hashlib.new = new_hashlib_with_md4
# --- end patch ---

load_dotenv()

log = logging.getLogger("auth_proxy")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

# Filter to exclude healthcheck requests from access logs
class HealthcheckFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # Filter out any log messages containing /health
        message = record.getMessage()
        if "/health" in message:
            return False
        return True

# Apply filter to uvicorn access logger to suppress healthcheck logs
uvicorn_access_logger = logging.getLogger("uvicorn.access")
uvicorn_access_logger.addFilter(HealthcheckFilter())

app = FastAPI(title="AD Auth Proxy", version="1.0.0")


class AuthRequest(BaseModel):
    login: str
    password: str


class UserInfo(BaseModel):
    login: str
    ip: str | None = None  # IP будет добавлен только при успехе


class AuthResult(BaseModel):
    success: bool
    message: str = ""
    user: UserInfo | None = None


LDAP_CONTROLLER = os.getenv("LDAP_CONTROLLER", "intranet.posta.md")
LDAP_PORT = int(os.getenv("LDAP_PORT", "389"))
LDAP_DOMAIN = os.getenv("LDAP_DOMAIN", "")
LDAP_USE_SSL = os.getenv("LDAP_USE_SSL", "false").lower() == "true"
LDAP_STARTTLS = os.getenv("LDAP_STARTTLS", "false").lower() == "true"
LDAP_REALM = os.getenv("LDAP_REALM", "")


@app.get("/health", response_model=AuthResult)
def health_check():
    # ВАЖНО: Этот endpoint НЕ делает запросов к AD/LDAP!
    # Он используется только для healthcheck и не должен обращаться к LDAP серверу
    # Если вы видите AD запросы когда ничего не происходит - это ПРОБЛЕМА!
    return AuthResult(success=True, message="ok")


@app.post("/auth", response_model=AuthResult)
def authenticate(req: AuthRequest, request: Request):
    # --- Определяем IP клиента ---
    client_ip = request.client.host
    if "X-Forwarded-For" in request.headers:
        client_ip = request.headers["X-Forwarded-For"].split(",")[0].strip()
    elif "X-Real-IP" in request.headers:
        client_ip = request.headers["X-Real-IP"]

    if not req.login or not req.password:
        return AuthResult(success=False, message="missing credentials")

    log.warning("=== AD REQUEST STARTED ===")
    log.warning("Client IP: %s", client_ip)
    log.warning("User login attempt: %s", req.login)
    log.warning("========================")

    login_clean = req.login
    if '@' in login_clean:
        login_clean = login_clean.split('@')[0]
    if '\\' in login_clean:
        login_clean = login_clean.split('\\')[-1]

    user_ntlm = f"{LDAP_DOMAIN}\\{login_clean}" if LDAP_DOMAIN else login_clean

    server = Server(LDAP_CONTROLLER, port=LDAP_PORT, use_ssl=LDAP_USE_SSL, get_info=ALL)

    try:
        conn = Connection(server, user=user_ntlm, password=req.password, authentication=NTLM, auto_bind=False)
        conn.open()
        if LDAP_STARTTLS:
            if not conn.start_tls():
                raise LDAPStartTLSError(conn.last_error)

        if not conn.bind():
            raise LDAPBindError(conn.last_error)

        log.info("User %s authenticated - IP: %s", login_clean, client_ip)
        log.warning("=== AD REQUEST SUCCESS ===")
        conn.unbind()

        # ВОЗВРАЩАЕМ IP В ОТВЕТЕ
        return AuthResult(
            success=True,
            message="ok",
            user=UserInfo(login=login_clean, ip=client_ip)
        )

    except LDAPBindError:
        log.warning("Bind failed for %s (Cleaned: %s) from IP: %s", req.login, login_clean, client_ip)
        return AuthResult(success=False, message="invalid credentials or inactive account")
    except LDAPSocketOpenError as exc:
        log.error("LDAP unreachable from IP: %s | %s", client_ip, exc)
        return JSONResponse(status_code=503, content=AuthResult(success=False, message="AD unreachable").model_dump())
    except Exception as exc:
        log.exception("Auth error for %s (Cleaned: %s) (IP: %s)", req.login, login_clean, client_ip)
        return JSONResponse(status_code=500, content=AuthResult(success=False, message="server error").model_dump())
@app.get("/my-ip")
def get_my_ip(request: Request):
    """
    Возвращает IP-адрес клиента.
    Работает даже без аутентификации.
    """
    client_ip = request.client.host

    # Поддержка прокси
    if "X-Forwarded-For" in request.headers:
        client_ip = request.headers["X-Forwarded-For"].split(",")[0].strip()
    elif "X-Real-IP" in request.headers:
        client_ip = request.headers["X-Real-IP"]

    # Опционально: логируем
    log.info("IP request from: %s", client_ip)

    return {"ip": client_ip}