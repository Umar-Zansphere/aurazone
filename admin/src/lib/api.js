const buildUrl = (path, params) => {
  const url = new URL(`/api${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
};

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export const apiFetch = async (path, options = {}) => {
  const { params, headers, ...rest } = options;
  const response = await fetch(buildUrl(path, params), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json", 'ngrok-skip-browser-warning': 'true',
      ...(headers || {}),
    },
    ...rest,
    cache: "no-store",
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new ApiError(payload?.message || "Request failed", response.status, payload);
  }

  return payload;
};
