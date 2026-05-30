from io import BytesIO
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, UploadFile

from app.config import Settings
from app.s3_service import S3ImageService


class FakeS3Client:
    def __init__(self):
        self.uploads = []

    def upload_fileobj(self, fileobj, bucket, key, ExtraArgs):
        self.uploads.append(
            {
                "bucket": bucket,
                "key": key,
                "extra_args": ExtraArgs,
                "body": fileobj.read(),
            }
        )

    def list_objects_v2(self, **params):
        return {
            "Contents": [
                {
                    "Key": f"{params['Prefix']}first.jpg",
                    "Size": 10,
                    "LastModified": SimpleNamespace(isoformat=lambda: "2026-05-27T10:30:00+00:00"),
                }
            ]
        }

    def generate_presigned_url(self, operation, Params, ExpiresIn):
        return f"https://signed.example/{Params['Key']}?expires={ExpiresIn}&op={operation}"

    def get_paginator(self, operation):
        return SimpleNamespace(
            paginate=lambda **params: [
                {
                    "Contents": [
                        {
                            "Key": f"{params['Prefix']}first.jpg",
                            "Size": 10,
                            "LastModified": SimpleNamespace(isoformat=lambda: "2026-05-27T10:30:00+00:00"),
                        },
                        {
                            "Key": f"{params['Prefix']}two.txt",
                            "Size": 20,
                            "LastModified": SimpleNamespace(isoformat=lambda: "2026-05-27T10:30:00+00:00"),
                        },
                    ]
                }
            ]
        )


@pytest.fixture
def service(monkeypatch):
    fake_client = FakeS3Client()
    monkeypatch.setattr("app.s3_service.boto3.client", lambda *args, **kwargs: fake_client)
    settings = Settings(
        aws_access_key_id="key",
        aws_secret_access_key="secret",
        aws_region="us-east-1",
        s3_bucket_name="wedding-memories-gallery",
        presigned_url_expires_seconds=900,
    )
    return S3ImageService(settings), fake_client


def make_upload(filename="photo.png", content_type="image/png"):
    return UploadFile(filename=filename, file=BytesIO(b"image-bytes"), headers={"content-type": content_type})


def test_upload_uses_category_prefix_without_public_acl(service):
    s3_service, fake_client = service

    result = s3_service.upload_image("wedding", make_upload())

    upload = fake_client.uploads[0]
    assert upload["bucket"] == "wedding-memories-gallery"
    assert upload["key"].startswith("nature/")
    assert upload["key"].endswith(".png")
    assert upload["extra_args"] == {"ContentType": "image/png", "CacheControl": "public, max-age=31536000"}
    assert result["url"].startswith("https://signed.example/nature/")


def test_list_images_uses_prefix_and_presigned_urls(service):
    s3_service, _ = service

    result = s3_service.list_images("cousins")

    assert result["category"] == "cousins"
    assert result["images"][0]["key"] == "cars/first.jpg"
    assert result["images"][0]["url"] == "https://signed.example/cars/first.jpg?expires=900&op=get_object"


def test_invalid_category_returns_400(service):
    s3_service, _ = service

    with pytest.raises(HTTPException) as exc:
        s3_service.list_images("portraits")

    assert exc.value.status_code == 400


def test_missing_aws_configuration_returns_503():
    with pytest.raises(HTTPException) as exc:
        S3ImageService(Settings(aws_access_key_id="", aws_secret_access_key="", s3_bucket_name=""))

    assert exc.value.status_code == 503
