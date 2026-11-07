export type EnvironmentName = 'development' | 'test' | 'production';

export type ApiHealthStatus = 'ok' | 'degraded';

export interface ApiHealthResponse {
  status: ApiHealthStatus;
  service: string;
  version: string;
  environment: EnvironmentName;
  uptimeSeconds: number;
  timestamp: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
}

export interface ApiSuccessResponse<T> {
  data: T;
}
