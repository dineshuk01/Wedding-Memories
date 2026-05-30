import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
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
