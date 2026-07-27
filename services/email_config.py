from fastapi_mail import ConnectionConfig
from env_config import settings
from pydantic import SecretStr

config = ConnectionConfig(
    MAIL_USERNAME="rinkals.9856@gmail.com",
    MAIL_PASSWORD=SecretStr(settings.mail_password),
    MAIL_FROM="rinkals.9856@gmail.com",
    MAIL_SERVER="smtp.gmail.com",
    MAIL_PORT=587,
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True
)

