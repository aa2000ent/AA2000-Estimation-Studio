import { apiClient } from './api';

const SESSION_TOKEN_KEY = 'aa2000_estimation_session_token';

export interface BackendEmployee {
  Emp_IDno: string;
  Emp_fname: string;
  Emp_lname: string;
}

export interface BackendAccount {
  acc_ID: number;
  username: string;
  role_ID: number;
  role_name: string;
  status: string;
  acc_sessionID: number;
}

export interface BackendSession {
  s_ID: number;
  s_name: string;
  createdAt: string;
}

export interface PinLoginResponse {
  message: string;
  employee: BackendEmployee;
  account: BackendAccount;
  session: BackendSession;
}

/**
 * Login using either:
 * - account username + PIN
 * - employee ID + PIN
 */
export async function loginWithPin(
  identifier: string,
  pin: string
): Promise<PinLoginResponse> {
  const username = identifier.trim();
  const cleanedPin = pin.trim();

  if (!username || !cleanedPin) {
    throw new Error('Username/Employee ID and PIN are required.');
  }

  const response = await apiClient.post<PinLoginResponse>(
  '/security/pin-authenticate',
  {
    username,
    Emp_IDno: username,
    pin: cleanedPin,
  }
);

  if (!response.success || !response.data) {
    throw new Error(
      response.error?.message || 'Unable to log in.'
    );
  }

  const token = response.data.session?.s_name;

  if (!token) {
    throw new Error('Login succeeded but no session token was returned.');
  }

  // Use the session for future protected API requests
  apiClient.setSessionToken(token);

  // Keep session after page refresh
  sessionStorage.setItem(SESSION_TOKEN_KEY, token);

  return response.data;
}

/**
 * Restore the session token after refreshing the page.
 */
export function restoreSessionToken(): string | null {
  const token = sessionStorage.getItem(SESSION_TOKEN_KEY);

  if (token) {
    apiClient.setSessionToken(token);
  }

  return token;
}

/**
 * Remove the frontend session.
 */
export function clearSessionToken(): void {
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  apiClient.setSessionToken(null);
}

/**
 * Logout from backend and clear local session.
 */
export async function logout(): Promise<void> {
  try {
    const token =
      apiClient.getSessionToken() || restoreSessionToken();

    if (token) {
      await apiClient.post<{ message: string }>(
        '/security/logout'
      );
    }
  } finally {
    clearSessionToken();
  }
}