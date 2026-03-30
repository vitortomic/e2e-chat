export interface RegisterRequest {
  username: string;
  password: string;
  publicKeys: {
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
  };
}

export interface RegisterResponse {
  message: string;
  userId: string;
  username: string;
  token: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  userId: string;
  username: string;
  token: string;
}

export interface User {
  id: string;
  username: string;
}

export interface UserPublicKeys {
  userId: string;
  username: string;
  registrationId: number;
  deviceId: number;
  publicKeys: {
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
    oneTimePreKey: string | null;
  };
}
