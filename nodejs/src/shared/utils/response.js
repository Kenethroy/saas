export function successResponse({ message = "Success", data = null, meta = null } = {}) {
  const response = {
    message,
    data
  };

  if (meta !== null && meta !== undefined) {
    response.meta = meta;
  }

  return response;
}
