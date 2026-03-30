import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
  User,
  UserPublicKeys,
} from '../types';
import { API_BASE_URL } from '../config';
import { STORAGE_KEYS } from '../constants';

class ApiService {
  private token: string | null = null;

  async setToken(token: string): Promise<void> {
    this.token = token;
    await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  }

  async getToken(): Promise<string | null> {
    if (!this.token) {
      this.token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    }
    return this.token;
  }

  async clearToken(): Promise<void> {
    this.token = null;
    await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Authentication
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const response = await this.request<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    await this.setToken(response.token);
    return response;
  }

  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    await this.setToken(response.token);
    return response;
  }

  // Users
  async getCurrentUser(): Promise<User> {
    return this.request<User>('/users/me');
  }

  async getAllUsers(): Promise<{ users: User[] }> {
    return this.request<{ users: User[] }>('/users');
  }

  async getUserPublicKeys(userId: string): Promise<UserPublicKeys> {
    return this.request<UserPublicKeys>(`/users/${userId}/keys`);
  }

  async updatePublicKeys(publicKeys: {
    identityKey: string;
    signedPreKey: {
      keyId: number;
      publicKey: string;
      signature: string;
      timestamp: number;
    };
    preKeys: Array<{
      keyId: number;
      publicKey: string;
    }>;
    registrationId: number;
    deviceId: number;
  }): Promise<{ message: string }> {
    return this.request('/users/keys', {
      method: 'PUT',
      body: JSON.stringify({ publicKeys }),
    });
  }
}

export const api = new ApiService();
