import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_EXPIRY = '7d';

export interface TokenPayload {
  id: number;
  email: string;
  role: 'admin' | 'middle_supervisor' | 'high_supervisor' | 'middle_teacher' | 'high_teacher' | 'middle_counselor' | 'high_counselor' | 'middle_principal' | 'high_principal' | 'middle_monitor' | 'high_monitor' | 'middle_admin_staff' | 'high_admin_staff';
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Compare password
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate JWT token
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

// Verify JWT token
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

export function verifyTokenWithExpiry(token: string): { payload: TokenPayload | null; expired: boolean } {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return { payload: decoded, expired: false };
  } catch (error: unknown) {
    if (error instanceof jwt.TokenExpiredError) {
      return { payload: null, expired: true };
    }
    return { payload: null, expired: false };
  }
}

// Extract token from request
export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

// Authentication middleware
export async function authenticate(request: NextRequest) {
  const token = extractToken(request);
  if (!token) {
    return null;
  }
  return verifyToken(token);
}

// Response helpers
export function unauthorized() {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  );
}

export function forbidden(message: string = 'Forbidden') {
  return NextResponse.json(
    { error: message },
    { status: 403 }
  );
}

export function badRequest(message: string) {
  return NextResponse.json(
    { error: message },
    { status: 400 }
  );
}

export function notFound(message: string = 'Not found') {
  return NextResponse.json(
    { error: message },
    { status: 404 }
  );
}

export function serverError(message: string = 'Internal server error') {
  return NextResponse.json(
    { error: message },
    { status: 500 }
  );
}

export function success(data: any, status: number = 200) {
  return NextResponse.json(data, { status });
}
