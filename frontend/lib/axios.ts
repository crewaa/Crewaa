import axios from "axios"

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
})

/**
 * Error thrown for every failed API call.
 *
 * The previous implementation threw a bare `Error(detail)`, which discarded the
 * HTTP status — so callers could not tell a 429 (rate limited, worth retrying)
 * from a 500 (broken), and every page's `err?.response?.data?.detail` lookup was
 * reading a property that no longer existed.
 */
export class ApiError extends Error {
  status: number | null
  detail: string

  constructor(message: string, status: number | null) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.detail = message
  }
}

// Attach the bearer token. Registered before the response interceptor so the
// ordering reads in request → response order.
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

/**
 * Turn FastAPI's `detail` into a sentence a person can read.
 *
 * For normal errors `detail` is a string. For 422 validation errors it is an
 * ARRAY of objects like `{loc: ["body","email"], msg: "value is not a valid
 * email address", type: "value_error"}`. That array used to be passed straight
 * through as the error message, so users saw `[object Object]` instead of what
 * was wrong with their input.
 */
function readableDetail(detail: unknown): string {
  if (typeof detail === "string" && detail.trim()) return detail

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "string") return item
        if (item && typeof item === "object") {
          const { loc, msg } = item as { loc?: unknown[]; msg?: string }
          if (!msg) return null
          // Drop the "body"/"query" prefix and name the offending field.
          const field = Array.isArray(loc)
            ? loc.filter((p) => p !== "body" && p !== "query").join(" ")
            : ""
          return field ? `${field}: ${msg}` : msg
        }
        return null
      })
      .filter(Boolean) as string[]

    if (messages.length) return messages.join(". ")
  }

  return "Something went wrong"
}

/**
 * Silent re-authentication (V2 §2.3).
 *
 * Access tokens are short-lived, so until now an expired one meant the next
 * request 401'd and the user was dumped on /login — mid-message, mid-offer,
 * losing whatever they had typed. The refresh token lives in an httpOnly
 * cookie the browser attaches automatically (hence `withCredentials` above),
 * so the app can quietly get a new access token and carry on.
 *
 * Deliberately single-flight. A dashboard fires several requests at once, so an
 * expired token produces a burst of simultaneous 401s; refreshing per failed
 * request would send a stampede of /auth/refresh calls, and because the server
 * *rotates* the token on every use, all but one would be redeemed against an
 * already-superseded token and fail — logging the user out at precisely the
 * moment the feature exists to keep them in. One shared promise means they all
 * wait on the same refresh.
 */
let refreshInFlight: Promise<string> | null = null

// Endpoints where a 401 is the answer, not a stale session. Retrying these
// would turn "wrong password" into a pointless refresh attempt.
const NO_REFRESH = ["/auth/login", "/auth/signup", "/auth/refresh", "/auth/google"]

async function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
        {},
        // A bare axios instance, not `api`: going through `api` would re-enter
        // this same interceptor and recurse if the refresh itself 401s.
        { withCredentials: true },
      )
      .then((res) => {
        const token = res.data.access_token as string
        localStorage.setItem("access_token", token)
        return token
      })
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response) {
      const status = error.response.status
      const detail = readableDetail(error.response.data?.detail)
      const config = error.config as
        | (typeof error.config & { _retried?: boolean })
        | undefined

      const canRetry =
        status === 401 &&
        typeof window !== "undefined" &&
        config &&
        !config._retried &&
        !NO_REFRESH.some((path) => (config.url ?? "").includes(path))

      if (canRetry) {
        try {
          const token = await refreshAccessToken()
          // `_retried` guards against a loop: if the replayed request 401s
          // again, it falls through to the logout path below instead of
          // refreshing forever.
          config._retried = true
          config.headers = { ...config.headers, Authorization: `Bearer ${token}` }
          return api.request(config)
        } catch {
          // Refresh failed — the session is genuinely over. Fall through.
        }
      }

      // 401 with no way back: the token is missing, expired beyond refresh, or
      // revoked. Clear it so the app stops retrying with a dead credential.
      if (status === 401 && typeof window !== "undefined") {
        localStorage.removeItem("access_token")
      }

      throw new ApiError(detail, status)
    }

    if (error.request) {
      throw new ApiError("Backend not reachable", null)
    }

    throw error
  }
)
