import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { jwtConfig } from '../config/index.js';

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateToken = (userId: string): { token: string; refreshToken: string } => {
  const token = jwt.sign({ userId }, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
  });

  const refreshToken = jwt.sign({ userId, type: 'refresh' }, jwtConfig.secret, {
    expiresIn: jwtConfig.refreshExpiresIn,
  });

  return { token, refreshToken };
};

export const verifyToken = (token: string): { userId: string } => {
  return jwt.verify(token, jwtConfig.secret) as { userId: string };
};

export const generateId = (): string => {
  return uuidv4();
};

export const sanitizeUser = (user: any) => {
  const { password_hash, ...sanitized } = user;
  return sanitized;
};

export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};
