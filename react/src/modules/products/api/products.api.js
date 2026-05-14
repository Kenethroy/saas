import { apiClient } from "@/shared/api/client";

export async function getProducts(params = {}) {
  const response = await apiClient.get("/api/products", {
    params
  });

  return response.data;
}

export async function getProductVariantList(params = {}) {
  const response = await apiClient.get("/api/products/list", {
    params
  });

  return response.data;
}

export async function uploadProductImage(file, productName = "") {
  const formData = new FormData();
  if (productName) {
    // Must be appended before the file so multer can read it in storage.filename().
    formData.append("productName", productName);
  }
  formData.append("image", file);

  const response = await apiClient.post("/api/products/upload-image", formData);
  return response.data;
}

export async function deleteUploadedProductImage(fileUrl) {
  const response = await apiClient.delete("/api/products/upload-image", {
    data: {
      fileUrl
    }
  });

  return response.data;
}

export async function createProduct(payload) {
  const response = await apiClient.post("/api/products/create", payload);
  return response.data;
}

export async function updateProduct(productId, payload) {
  const response = await apiClient.patch(`/api/products/${productId}`, payload);
  return response.data;
}

export async function createProductVariant(productId, payload) {
  const response = await apiClient.post(`/api/products/${productId}/variants/create`, payload);
  return response.data;
}

export async function updateProductVariant(variantId, payload) {
  const response = await apiClient.patch(`/api/products/variants/${variantId}`, payload);
  return response.data;
}

export async function deleteProductVariant(variantId) {
  const response = await apiClient.delete(`/api/products/variants/${variantId}`);
  return response.data;
}

export async function getProductBrochurePdf() {
  const response = await apiClient.get("/api/products/brochure/pdf", {
    responseType: "blob"
  });

  return response.data;
}

export function resolveProductImageUrl(fileUrl) {
  if (!fileUrl) {
    return "/placeholder.png";
  }

  return fileUrl;
}
