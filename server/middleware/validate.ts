import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';

export const validate = (validations: any[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    next();
  };
};

export const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('displayName').optional().isLength({ max: 100 }).trim(),
];

export const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

export const profileUpdateValidation = [
  body('displayName').optional().isLength({ max: 100 }).trim(),
  body('bio').optional().isLength({ max: 2000 }).trim(),
  body('age').optional().isInt({ min: 18, max: 100 }),
  body('gender').optional().isIn(['male', 'female', 'non-binary', 'other', 'prefer not to say']),
];

export const messageValidation = [
  body('text').optional().isLength({ max: 5000 }).trim(),
  body('mediaUrl').optional().isURL(),
];
