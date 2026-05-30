import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: BASE_URL,
});

export async function uploadImage(category, file, onUploadProgress) {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.post(`/upload/${category}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress,
  });

  return data.image;
}

export async function fetchImages(category, nextToken) {
  const { data } = await api.get(`/images/${category}`, {
    params: {
      limit: 40,
      next_token: nextToken || undefined,
    },
  });

  return data;
}

export async function fetchCategoryCounts() {
  const { data } = await api.get("/categories");
  return data.counts;
}

/**
 * Triggers a real file download by routing through the backend /download proxy.
 * This avoids S3 CORS issues that would prevent a direct browser fetch of presigned URLs.
 */
export function downloadImageByKey(key) {
  const filename = key.split("/").pop() || "wedding-photo.jpg";
  const url = `${BASE_URL}/download?key=${encodeURIComponent(key)}`;

  // Create a hidden <a> and click it — works on desktop and mobile browsers
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

/**
 * Sends login credentials to the backend for validation.
 * Credentials are stored in backend/.env — never in the frontend bundle.
 * Returns true on success, throws an error with a message on failure.
 */
export async function loginUser(username, password) {
  const { data } = await api.post("/auth/login", { username, password });
  return data.authenticated === true;
}

