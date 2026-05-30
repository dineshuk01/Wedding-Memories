import os

from fastapi import Depends, FastAPI, File, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
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
