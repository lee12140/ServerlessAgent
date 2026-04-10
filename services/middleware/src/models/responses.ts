export type ErrorCode =
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'MESSAGE_REQUIRED'
  | 'MESSAGE_TOO_LONG'
  | 'INVALID_CONTENT_TYPE'
  | 'INTERNAL_ERROR';

export interface ErrorResponse {
  error: string;
  code: ErrorCode;
}

export interface TextSuccessResponse {
  message: string;
  sessionId: string;
  requestId: string;
}

export interface AgentResponse {
  message: string;
  sessionId: string;
}
