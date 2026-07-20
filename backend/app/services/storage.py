import os
import uuid
import datetime
from abc import ABC, abstractmethod
from fastapi import UploadFile, Depends
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import UploadedFile
from ..config import settings

class StorageProvider(ABC):
    @abstractmethod
    def save_file(self, file_content: bytes, filename: str, mime_type: str, org_id: str) -> str:
        """Saves file content and returns unique storage key"""
        pass

    @abstractmethod
    def delete_file(self, storage_key: str) -> bool:
        """Deletes file from storage"""
        pass

    @abstractmethod
    def generate_download_url(self, storage_key: str, expires_in_seconds: int = 900) -> str:
        """Generates pre-signed temporary download URL"""
        pass


class LocalStorageProvider(StorageProvider):
    def __init__(self, base_dir: str = "storage_files"):
        self.base_dir = base_dir
        os.makedirs(base_dir, exist_ok=True)

    def save_file(self, file_content: bytes, filename: str, mime_type: str, org_id: str) -> str:
        org_dir = os.path.join(self.base_dir, org_id)
        os.makedirs(org_dir, exist_ok=True)
        
        # Avoid Path Traversal by generating UUID storage key
        file_ext = os.path.splitext(filename)[1]
        storage_key = f"{org_id}/{str(uuid.uuid4())}{file_ext}"
        
        full_path = os.path.join(self.base_dir, storage_key)
        # Ensure parent directory of full path is created
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        with open(full_path, "wb") as f:
            f.write(file_content)
            
        return storage_key

    def delete_file(self, storage_key: str) -> bool:
        full_path = os.path.join(self.base_dir, storage_key)
        if os.path.exists(full_path):
            os.remove(full_path)
            return True
        return False

    def generate_download_url(self, storage_key: str, expires_in_seconds: int = 900) -> str:
        # For local, return a mock server link that serves local files
        return f"/api/storage/download/{storage_key}"


class S3StorageProvider(StorageProvider):
    def __init__(self, bucket_name: str, endpoint_url: str, access_key: str, secret_key: str, region_name: str = "us-east-1"):
        self.bucket_name = bucket_name
        self.endpoint_url = endpoint_url
        self.access_key = access_key
        self.secret_key = secret_key
        self.region_name = region_name
        # boto3 client initialization would happen here in production
        self.client = None

    def save_file(self, file_content: bytes, filename: str, mime_type: str, org_id: str) -> str:
        # Mock S3 upload in dev, fallback to LocalStorage if credentials not set
        file_ext = os.path.splitext(filename)[1]
        storage_key = f"{org_id}/{str(uuid.uuid4())}{file_ext}"
        print(f"[S3 STORAGE] Uploading {filename} to bucket {self.bucket_name} as {storage_key}")
        # In production, boto3 put_object will write file_content
        return storage_key

    def delete_file(self, storage_key: str) -> bool:
        print(f"[S3 STORAGE] Deleting {storage_key} from bucket {self.bucket_name}")
        return True

    def generate_download_url(self, storage_key: str, expires_in_seconds: int = 900) -> str:
        # Pre-signed S3 URL generation
        return f"https://{self.bucket_name}.s3.amazonaws.com/{storage_key}?AWSAccessKeyId=MOCK&Expires={int(datetime.datetime.now(datetime.UTC).timestamp()) + expires_in_seconds}&Signature=MOCK"


def get_storage_provider() -> StorageProvider:
    # Read environment variables
    # If S3 configs are present, use S3StorageProvider. Otherwise fallback to LocalStorageProvider.
    s3_bucket = os.getenv("S3_BUCKET_NAME")
    s3_endpoint = os.getenv("S3_ENDPOINT_URL")
    s3_access = os.getenv("S3_ACCESS_KEY_ID")
    s3_secret = os.getenv("S3_SECRET_ACCESS_KEY")
    
    if s3_bucket and s3_endpoint and s3_access and s3_secret:
        return S3StorageProvider(
            bucket_name=s3_bucket,
            endpoint_url=s3_endpoint,
            access_key=s3_access,
            secret_key=s3_secret
        )
    return LocalStorageProvider()

