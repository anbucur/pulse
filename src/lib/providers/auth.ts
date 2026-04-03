// Authentication Provider Interface
export interface AuthUser {
  id: string;
  email: string;
  isVerified: boolean;
  isPremium: boolean;
  createdAt: number;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterData extends AuthCredentials {
  displayName?: string;
}

export interface AuthResult {
  user: AuthUser;
  token: string;
  refreshToken?: string;
}

export interface IAuthProvider {
  register(data: RegisterData): Promise<AuthResult>;
  login(credentials: AuthCredentials): Promise<AuthResult>;
  verifyToken(token: string): Promise<AuthUser>;
  refreshToken(refreshToken: string): Promise<AuthResult>;
  resetPassword(email: string): Promise<void>;
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;
  logout(token: string): Promise<void>;
}

// JWT + Bcrypt Implementation
export class AuthProvider implements IAuthProvider {
  private jwtSecret: string;
  private jwtExpiresIn: string;
  private refreshExpiresIn: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
    this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  }

  async register(data: RegisterData): Promise<AuthResult> {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Registration failed');
    }

    return response.json();
  }

  async login(credentials: AuthCredentials): Promise<AuthResult> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    return response.json();
  }

  async verifyToken(token: string): Promise<AuthUser> {
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Token verification failed');
    }

    return response.json();
  }

  async refreshToken(refreshToken: string): Promise<AuthResult> {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    return response.json();
  }

  async resetPassword(email: string): Promise<void> {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    if (!response.ok) {
      throw new Error('Password reset failed');
    }
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ oldPassword, newPassword })
    });

    if (!response.ok) {
      throw new Error('Password change failed');
    }
  }

  async logout(token: string): Promise<void> {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  }
}

export const authProvider = new AuthProvider();
