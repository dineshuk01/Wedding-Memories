# Wedding Memories S3 Gallery

A modern full-stack image gallery with a React + Tailwind CSS frontend and FastAPI backend using AWS S3 folders for categorized image storage.

## Folder Structure

```text
Wedding-Memories/
  backend/
    app/
      config.py
      main.py
      s3_service.py
    .env.example
    requirements.txt
  frontend/
    src/
      api/
      components/
      data/
      App.jsx
      main.jsx
      styles.css
    .env.example
    package.json
    tailwind.config.js
  README.md
```

## Features

- Upload images to `wedding/`, `cousins/`, `haldi/`, and `mehndi/` S3 prefixes.
- View category-specific galleries with lazy loading, masonry columns, search, lightbox previews, skeleton loading, empty states, and infinite scroll support.
- Upload progress bar, toast notifications, drag and drop upload, preview, and animated success state.
- Premium dark UI with glassmorphism cards, gradients, responsive layout, Framer Motion animations, and React Icons.

## Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Edit `backend/.env`:

```env
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=wedding-memories-gallery
FRONTEND_ORIGIN=http://localhost:5173
PRESIGNED_URL_EXPIRES_SECONDS=3600
```

Run the API:

```bash
uvicorn app.main:app --reload --port 8001
```

API endpoints:

- `POST /upload/{category}` with multipart form field `file`
- `GET /images/{category}?limit=40&next_token=...`
- `GET /health`

## Frontend Setup

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## S3 Notes

The backend writes objects to these prefixes:

```text
s3://mybucket/wedding/
s3://mybucket/cousins/
s3://mybucket/haldi/
s3://mybucket/mehndi/
```

Keep the bucket private and enable **Block all public access**. The backend uploads private objects and returns temporary presigned URLs for viewing, so direct S3 object URLs should not be public.

Minimum IAM permissions for the app user or role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::wedding-memories-gallery"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": [
        "arn:aws:s3:::wedding-memories-gallery/wedding/*",
        "arn:aws:s3:::wedding-memories-gallery/cousins/*",
        "arn:aws:s3:::wedding-memories-gallery/haldi/*",
        "arn:aws:s3:::wedding-memories-gallery/mehndi/*"
      ]
    }
  ]
}
```
