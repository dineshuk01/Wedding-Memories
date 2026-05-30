import os

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from .config import Settings, get_settings
from .s3_service import ALLOWED_CATEGORIES, S3ImageService

load_dotenv()

app = FastAPI(
    title="Wedding Memories Gallery API",
    version="1.0.0",
    description="FastAPI backend for uploading and browsing categorized S3 images.",
)

frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").rstrip("/")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin, "http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+):\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    from .s3_service import start_thumbnail_migration
    try:
        settings = get_settings()
        service = S3ImageService(settings)
        start_thumbnail_migration(service)
    except Exception as exc:
        print(f"Could not start background S3 thumbnail migration: {exc}")


def get_s3_service(settings: Settings = Depends(get_settings)) -> S3ImageService:
    return S3ImageService(settings)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/auth/login")
def login(
    body: LoginRequest,
    settings: Settings = Depends(get_settings),
) -> dict:
    """
    Validates login credentials stored in the backend .env file.
    The actual username/password are never sent to or stored in the frontend.
    """
    if body.username != settings.app_username or body.password != settings.app_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
        )
    return {"authenticated": True}


@app.post("/upload/{category}")
async def upload_image(
    category: str,
    file: UploadFile = File(...),
    service: S3ImageService = Depends(get_s3_service),
) -> dict:
    uploaded = service.upload_image(category, file)
    return {"message": "Upload complete", "image": uploaded}


@app.get("/images/{category}")
def get_images(
    category: str,
    limit: int = Query(60, ge=1, le=100),
    next_token: str | None = None,
    service: S3ImageService = Depends(get_s3_service),
) -> dict:
    return service.list_images(category, limit=limit, continuation_token=next_token)


@app.get("/categories")
def get_categories(service: S3ImageService = Depends(get_s3_service)) -> dict:
    categories = sorted(ALLOWED_CATEGORIES)
    return {
        "categories": categories,
        "counts": service.counts_by_category(categories),
    }


@app.get("/download")
def download_image(
    key: str,
    service: S3ImageService = Depends(get_s3_service),
) -> StreamingResponse:
    """
    Proxy-download an image from S3 with Content-Disposition: attachment so the
    browser saves it as a file rather than opening it in a new tab.
    This sidesteps S3 CORS restrictions that would block a direct browser fetch.
    """
    import urllib.parse
    from botocore.exceptions import BotoCoreError, ClientError
    from fastapi import HTTPException, status

    try:
        resp = service.client.get_object(
            Bucket=service.settings.s3_bucket_name,
            Key=key,
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found in S3.",
        ) from exc

    content_type = resp.get("ContentType", "image/jpeg")
    filename = key.split("/")[-1] or "wedding-photo.jpg"
    encoded_filename = urllib.parse.quote(filename)

    return StreamingResponse(
        content=resp["Body"].iter_chunks(chunk_size=65536),
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"; filename*=UTF-8\'\'{encoded_filename}',
            "Cache-Control": "private, no-store",
        },
    )
