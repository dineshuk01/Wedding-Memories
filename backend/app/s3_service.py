from __future__ import annotations

from datetime import datetime, timezone, timedelta
import io
from pathlib import Path
import threading
import time
from typing import Any, Dict, Iterable, List
from uuid import uuid4

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps

from .config import Settings


ALLOWED_CATEGORIES = {"wedding", "cousins", "haldi", "mehndi"}
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

CATEGORY_TO_S3_FOLDER = {
    "wedding": "nature",
    "cousins": "cars",
    "haldi": "animals",
    "mehndi": "technology"
}

# Thread-safe in-memory cache for S3 image metadata
_S3_IMAGE_CACHE: Dict[str, List[Dict[str, Any]]] = {}
_S3_CACHE_LAST_UPDATED: Dict[str, float] = {}
_S3_CACHE_LOCK = threading.Lock()
_CACHE_TTL = 30.0  # seconds (adjustable cache time to balance responsiveness and performance)

# Thread-safe tracker for categories currently being revalidated in background
_REVALIDATING_CATEGORIES = set()
_REVALIDATION_LOCK = threading.Lock()


def _bg_revalidate_task(s3_service_instance: S3ImageService, category: str) -> None:
    try:
        s3_service_instance._fetch_and_cache_images(category)
    except Exception:
        # Prevent background thread crashes
        pass
    finally:
        with _REVALIDATION_LOCK:
            _REVALIDATING_CATEGORIES.discard(category)


# Thread-safe tracker for background thumbnail generation tasks
_THUMBNAIL_GENERATION_IN_PROGRESS = set()
_THUMBNAIL_LOCK = threading.Lock()


def get_relative_key(key: str, s3_folder: str) -> tuple[str, bool]:
    """
    Extracts the relative file path for grouping, and checks if it is a thumbnail.
    Examples:
      'nature/original/3/photo.jpg' -> ('3/photo.jpg', False)
      'nature/thumbnails/3/photo.jpg' -> ('3/photo.jpg', True)
      'nature/3/photo.jpg' -> ('3/photo.jpg', False)
    """
    prefix = f"{s3_folder}/"
    if not key.startswith(prefix):
        return key, False

    rel = key[len(prefix):]
    if rel.startswith("original/"):
        return rel[len("original/"):], False
    elif rel.startswith("thumbnails/"):
        return rel[len("thumbnails/"):], True
    else:
        return rel, False


def _trigger_thumbnail_generation(s3_service_instance: S3ImageService, original_key: str, rel_key: str, category: str) -> None:
    global _THUMBNAIL_GENERATION_IN_PROGRESS
    with _THUMBNAIL_LOCK:
        if original_key in _THUMBNAIL_GENERATION_IN_PROGRESS:
            return
        _THUMBNAIL_GENERATION_IN_PROGRESS.add(original_key)

    def run():
        try:
            s3_folder = CATEGORY_TO_S3_FOLDER[category]
            thumbnail_key = f"{s3_folder}/thumbnails/{rel_key}"

            # Download original
            resp = s3_service_instance.client.get_object(
                Bucket=s3_service_instance.settings.s3_bucket_name,
                Key=original_key
            )
            original_bytes = resp["Body"].read()
            content_type = resp.get("ContentType", "image/jpeg")

            # Generate thumbnail
            thumbnail_bytes = s3_service_instance._create_thumbnail(original_bytes)

            # Upload thumbnail
            s3_service_instance.client.upload_fileobj(
                io.BytesIO(thumbnail_bytes),
                s3_service_instance.settings.s3_bucket_name,
                thumbnail_key,
                ExtraArgs={
                    "ContentType": content_type,
                    "CacheControl": "public, max-age=31536000",
                },
            )
        except Exception:
            pass
        finally:
            with _THUMBNAIL_LOCK:
                _THUMBNAIL_GENERATION_IN_PROGRESS.discard(original_key)

    thread = threading.Thread(target=run, daemon=True)
    thread.start()


# Thread-safe in-memory cache for the boto3 S3 client to prevent WinError 10055 socket exhaustion
_S3_CLIENT_CACHE = None
_S3_CLIENT_LOCK = threading.Lock()

# Thread-safe in-memory cache for CloudFront RSA URL signer
_CF_SIGNER_CACHE = None
_CF_SIGNER_LOCK = threading.Lock()



def normalize_category(category: str) -> str:
    normalized = category.strip().lower()
    if normalized not in ALLOWED_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported category '{category}'.",
        )
    return normalized


class S3ImageService:
    def __init__(self, settings: Settings):
        self.settings = settings
        if not all([settings.aws_access_key_id, settings.aws_secret_access_key, settings.s3_bucket_name]):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AWS S3 environment variables are not configured.",
            )
        import sys
        global _S3_CLIENT_CACHE
        
        is_testing = "pytest" in sys.modules or "unittest" in sys.modules
        if is_testing:
            self.client = boto3.client(
                "s3",
                aws_access_key_id=settings.aws_access_key_id,
                aws_secret_access_key=settings.aws_secret_access_key,
                region_name=settings.aws_region,
            )
            return

        if _S3_CLIENT_CACHE is None:
            with _S3_CLIENT_LOCK:
                if _S3_CLIENT_CACHE is None:
                    _S3_CLIENT_CACHE = boto3.client(
                        "s3",
                        aws_access_key_id=settings.aws_access_key_id,
                        aws_secret_access_key=settings.aws_secret_access_key,
                        region_name=settings.aws_region,
                    )
        self.client = _S3_CLIENT_CACHE

    @staticmethod
    def _create_thumbnail(file_bytes: bytes, max_size: tuple[int, int] = (600, 600)) -> bytes:
        try:
            image = Image.open(io.BytesIO(file_bytes))
            
            # Handle orientation from EXIF metadata (crucial for vertical phone / DSLR photos!)
            try:
                image = ImageOps.exif_transpose(image)
            except Exception:
                pass

            # Generate high-quality thumbnail preserving aspect ratio
            image.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            thumb_io = io.BytesIO()
            format_type = "JPEG" if image.mode in ("RGB", "L") else "PNG"
            image.save(thumb_io, format=format_type, quality=85, optimize=True)
            return thumb_io.getvalue()
        except Exception:
            # Fallback to returning original file bytes if PIL processing fails
            return file_bytes

    def _fetch_and_cache_images(self, category: str) -> list[dict[str, Any]]:
        category = normalize_category(category)
        s3_folder = CATEGORY_TO_S3_FOLDER[category]
        grouped_images = {}
        paginator = self.client.get_paginator("list_objects_v2")
        try:
            pages = paginator.paginate(
                Bucket=self.settings.s3_bucket_name,
                Prefix=f"{s3_folder}/",
            )
            for page in pages:
                for item in page.get("Contents", []):
                    key = item["Key"]
                    if self._is_image_key(key):
                        last_mod = item.get("LastModified")
                        if last_mod and hasattr(last_mod, "isoformat"):
                            last_mod_str = last_mod.isoformat()
                        elif isinstance(last_mod, str):
                            last_mod_str = last_mod
                        else:
                            last_mod_str = datetime.now(timezone.utc).isoformat()

                        # Parse S3 key style to get unique relative path for grouping, and if it is thumbnail
                        rel_key, is_thumb = get_relative_key(key, s3_folder)

                        if rel_key not in grouped_images:
                            grouped_images[rel_key] = {
                                "key": key if not is_thumb else None,
                                "thumbnail_key": key if is_thumb else None,
                                "size": item.get("Size", 0) if not is_thumb else 0,
                                "last_modified": last_mod_str,
                            }
                        else:
                            # Merge thumbnail and original records
                            if is_thumb:
                                grouped_images[rel_key]["thumbnail_key"] = key
                            else:
                                grouped_images[rel_key]["key"] = key
                                grouped_images[rel_key]["size"] = item.get("Size", 0)
                                grouped_images[rel_key]["last_modified"] = last_mod_str
        except (BotoCoreError, ClientError) as exc:
            # If call fails but we have stale cache, fallback to it
            with _S3_CACHE_LOCK:
                if category in _S3_IMAGE_CACHE:
                    return _S3_IMAGE_CACHE[category]
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not fetch images from S3.",
            ) from exc

        # Flatten and clean up any partial groups (e.g. if original or thumbnail is missing)
        all_items = []
        for rel_key, img in grouped_images.items():
            original_key = img["key"]
            thumbnail_key = img["thumbnail_key"]

            # Fallback to each other if one of them is missing (e.g. old uploads or partial fails)
            if not original_key:
                original_key = thumbnail_key
            if not thumbnail_key:
                # If there's no thumbnail key, use original key as fallback,
                # AND trigger background thumbnail generation!
                thumbnail_key = original_key
                if original_key:
                    _trigger_thumbnail_generation(self, original_key, rel_key, category)

            if original_key:  # Safeguard to verify key presence
                all_items.append({
                    "key": original_key,
                    "thumbnail_key": thumbnail_key,
                    "size": img["size"],
                    "last_modified": img["last_modified"],
                })

        # Sort all items by last_modified descending (newest first)
        all_items.sort(key=lambda x: x["last_modified"], reverse=True)

        with _S3_CACHE_LOCK:
            _S3_IMAGE_CACHE[category] = all_items
            _S3_CACHE_LAST_UPDATED[category] = time.time()
        return all_items

    def _trigger_background_revalidate(self, category: str) -> None:
        global _REVALIDATING_CATEGORIES
        with _REVALIDATION_LOCK:
            if category in _REVALIDATING_CATEGORIES:
                return
            _REVALIDATING_CATEGORIES.add(category)

        thread = threading.Thread(
            target=_bg_revalidate_task,
            args=(self, category),
            daemon=True,
        )
        thread.start()

    def _get_cached_images(self, category: str) -> list[dict[str, Any]]:
        category = normalize_category(category)
        now = time.time()

        # Check if cache is completely fresh
        with _S3_CACHE_LOCK:
            has_cache = category in _S3_IMAGE_CACHE
            cache_age = now - _S3_CACHE_LAST_UPDATED.get(category, 0.0)
            if has_cache and cache_age < _CACHE_TTL:
                return _S3_IMAGE_CACHE[category]

        # Stale-While-Revalidate: return stale data immediately & trigger background update
        if has_cache:
            self._trigger_background_revalidate(category)
            return _S3_IMAGE_CACHE[category]

        # Blocking Fetch: cache is completely empty
        return self._fetch_and_cache_images(category)

    def upload_image(self, category: str, file: UploadFile) -> dict:
        category = normalize_category(category)
        if file.content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Only JPEG, PNG, WebP, and GIF images are supported.",
            )

        extension = Path(file.filename or "image").suffix.lower()
        if extension not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
            extension = ".jpg"

        s3_folder = CATEGORY_TO_S3_FOLDER[category]
        filename = f"{datetime.now(timezone.utc):%Y%m%dT%H%M%S}-{uuid4().hex}{extension}"
        original_key = f"{s3_folder}/original/{filename}"
        thumbnail_key = f"{s3_folder}/thumbnails/{filename}"

        # Read original file bytes to generate thumbnail
        try:
            original_bytes = file.file.read()
            # Reset seek position so we can upload it
            file.file.seek(0)
            file_size = len(original_bytes)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not read uploaded file.",
            ) from exc

        # Create optimized thumbnail bytes
        thumbnail_bytes = self._create_thumbnail(original_bytes)

        # Upload original file to S3
        try:
            self.client.upload_fileobj(
                file.file,
                self.settings.s3_bucket_name,
                original_key,
                ExtraArgs={
                    "ContentType": file.content_type,
                    "CacheControl": "public, max-age=31536000",
                },
            )
        except (BotoCoreError, ClientError) as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Original image upload to S3 failed.",
            ) from exc

        # Upload optimized thumbnail bytes to S3
        try:
            self.client.upload_fileobj(
                io.BytesIO(thumbnail_bytes),
                self.settings.s3_bucket_name,
                thumbnail_key,
                ExtraArgs={
                    "ContentType": file.content_type,
                    "CacheControl": "public, max-age=31536000",
                },
            )
        except (BotoCoreError, ClientError) as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Thumbnail image upload to S3 failed.",
            ) from exc

        # Immediately update local in-memory cache to prepend this newly uploaded image
        new_image = {
            "key": original_key,
            "thumbnail_key": thumbnail_key,
            "size": file_size,
            "last_modified": datetime.now(timezone.utc).isoformat(),
        }

        with _S3_CACHE_LOCK:
            if category in _S3_IMAGE_CACHE:
                _S3_IMAGE_CACHE[category].insert(0, new_image)
            else:
                _S3_IMAGE_CACHE[category] = [new_image]
            # Set/Reset cache update time to current timestamp so we trust this state
            _S3_CACHE_LAST_UPDATED[category] = time.time()

        return {
            "key": original_key,
            "category": category,
            "url": self.presigned_url(thumbnail_key),
            "original_url": self.presigned_url(original_key),
            "filename": file.filename,
            "content_type": file.content_type,
        }

    def list_images(self, category: str, limit: int = 60, continuation_token: str | None = None) -> dict:
        category = normalize_category(category)

        # Parse continuation token as an offset integer index
        offset = 0
        if continuation_token:
            try:
                offset = int(continuation_token)
            except ValueError:
                offset = 0

        # Retrieve cached, sorted images
        all_images = self._get_cached_images(category)
        total_count = len(all_images)

        # Slice the requested page
        limit = min(max(limit, 1), 100)
        sliced = all_images[offset:offset + limit]

        # Generate presigned URLs on the fly only for this slice
        images = []
        for img in sliced:
            thumb_key = img.get("thumbnail_key") or img["key"]
            images.append({
                "key": img["key"],
                "url": self.presigned_url(thumb_key),
                "original_url": self.presigned_url(img["key"]),
                "size": img["size"],
                "last_modified": img["last_modified"],
            })

        # Calculate next token (offset index string or None if end is reached)
        next_offset = offset + limit
        next_token = str(next_offset) if next_offset < total_count else None

        return {
            "category": category,
            "images": images,
            "count": len(images),
            "next_token": next_token,
        }

    def counts_by_category(self, categories: Iterable[str]) -> dict[str, int]:
        counts: dict[str, int] = {}
        for category in categories:
            try:
                counts[category] = len(self._get_cached_images(category))
            except Exception:
                counts[category] = 0
        return counts

    def _get_cloudfront_signer(self):
        global _CF_SIGNER_CACHE
        if _CF_SIGNER_CACHE is not None:
            return _CF_SIGNER_CACHE

        with _CF_SIGNER_LOCK:
            if _CF_SIGNER_CACHE is not None:
                return _CF_SIGNER_CACHE

            # Load private key from PEM file path
            try:
                pem_path = self.settings.cloudfront_private_key_path
                with open(pem_path, "rb") as key_file:
                    private_key_bytes = key_file.read()
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Could not load CloudFront private key from path '{self.settings.cloudfront_private_key_path}'",
                ) from exc

            # Load private key object
            try:
                from cryptography.hazmat.primitives import serialization
                from cryptography.hazmat.primitives.asymmetric import padding
                from cryptography.hazmat.primitives import hashes
                
                private_key = serialization.load_pem_private_key(
                    private_key_bytes,
                    password=None
                )
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Invalid RSA private key for CloudFront.",
                ) from exc

            # RSA Signer helper required by botocore.signers.CloudFrontSigner
            def rsa_signer(message):
                return private_key.sign(
                    message,
                    padding.PKCS1v15(),
                    hashes.SHA1()
                )

            from botocore.signers import CloudFrontSigner
            _CF_SIGNER_CACHE = CloudFrontSigner(self.settings.cloudfront_key_id, rsa_signer)
            return _CF_SIGNER_CACHE

    def presigned_url(self, key: str) -> str:
        # Check if CloudFront CDN is configured for delivery
        if self.settings.cloudfront_domain:
            cf_domain = self.settings.cloudfront_domain.rstrip("/")
            if not cf_domain.startswith("http"):
                cf_domain = f"https://{cf_domain}"
            resource_url = f"{cf_domain}/{key}"

            # If signed URLs are configured
            if self.settings.cloudfront_key_id and self.settings.cloudfront_private_key_path:
                try:
                    signer = self._get_cloudfront_signer()
                    expire_time = datetime.now(timezone.utc) + timedelta(seconds=self.settings.presigned_url_expires_seconds)
                    return signer.generate_presigned_url(
                        url=resource_url,
                        date_less_than=expire_time
                    )
                except Exception as exc:
                    pass # Fallback to S3
            else:
                # Public CloudFront URL
                return resource_url
                
                
        # S3 presigned URL fallback
        try:
            return self.client.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": self.settings.s3_bucket_name,
                    "Key": key,
                },
                ExpiresIn=self.settings.presigned_url_expires_seconds,
            )
        except (BotoCoreError, ClientError) as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not generate a temporary image URL.",
            ) from exc

    @staticmethod
    def _is_image_key(key: str) -> bool:
        return key.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".gif"))


# Global state to prevent starting multiple migration workers
_MIGRATION_STARTED = False
_MIGRATION_LOCK = threading.Lock()


def start_thumbnail_migration(s3_service: S3ImageService) -> None:
    global _MIGRATION_STARTED
    with _MIGRATION_LOCK:
        if _MIGRATION_STARTED:
            return
        _MIGRATION_STARTED = True

    thread = threading.Thread(
        target=_bg_thumbnail_migration_worker,
        args=(s3_service,),
        daemon=True,
    )
    thread.start()


def _bg_thumbnail_migration_worker(s3_service: S3ImageService) -> None:
    import time
    # Give the server a few seconds to start up fully before starting heavy work
    time.sleep(5.0)

    try:
        # Migrate all categories
        for category in ALLOWED_CATEGORIES:
            s3_folder = CATEGORY_TO_S3_FOLDER[category]

            # 1. Scan S3 to find all keys for this category
            paginator = s3_service.client.get_paginator("list_objects_v2")
            pages = paginator.paginate(
                Bucket=s3_service.settings.s3_bucket_name,
                Prefix=f"{s3_folder}/",
            )

            thumbnails_keys = set()
            original_images = []

            for page in pages:
                for item in page.get("Contents", []):
                    key = item["Key"]
                    if s3_service._is_image_key(key):
                        rel_key, is_thumb = get_relative_key(key, s3_folder)
                        if is_thumb:
                            thumbnails_keys.add(rel_key)
                        else:
                            original_images.append((key, rel_key))

            # 2. Filter images that are missing thumbnails
            missing = [(orig, rel) for orig, rel in original_images if rel not in thumbnails_keys]

            # 3. Sequentially generate and upload thumbnails
            for original_key, rel_key in missing:
                try:
                    thumbnail_key = f"{s3_folder}/thumbnails/{rel_key}"

                    # Download original
                    resp = s3_service.client.get_object(
                        Bucket=s3_service.settings.s3_bucket_name,
                        Key=original_key
                    )
                    original_bytes = resp["Body"].read()
                    content_type = resp.get("ContentType", "image/jpeg")

                    # Generate thumbnail
                    thumbnail_bytes = s3_service._create_thumbnail(original_bytes)

                    # Upload thumbnail
                    s3_service.client.upload_fileobj(
                        io.BytesIO(thumbnail_bytes),
                        s3_service.settings.s3_bucket_name,
                        thumbnail_key,
                        ExtraArgs={
                            "ContentType": content_type,
                            "CacheControl": "public, max-age=31536000",
                        },
                    )

                    # Invalidate local cache for this category so it picks up the new thumbnail
                    with _S3_CACHE_LOCK:
                        _S3_CACHE_LAST_UPDATED.pop(category, None)

                    # Sleep slightly to prevent CPU/S3 throttling
                    time.sleep(0.3)
                except Exception:
                    # Ignore individual image errors and continue with the next
                    time.sleep(1.0)

    except Exception:
        # Prevent migration worker crashes from affecting the server
        pass
    finally:
        global _MIGRATION_STARTED
        with _MIGRATION_LOCK:
            _MIGRATION_STARTED = False
