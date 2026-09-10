import { z } from 'zod';

export const loginSchema = z.object({
  login: z.string().min(1, 'Enter your username or email'),
  password: z.string().min(1, 'Enter your password'),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const activateSchema = z
  .object({
    token: z.string().min(8, 'Invitation token is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const studentSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  birthdate: z.string().optional(),
  gender: z.string().optional(),
  program: z.string().optional(),
  status: z.string().default('active'),
});

export const enrollPublicSchema = z.object({
  studentFullname: z.string().min(2, 'Student name is required'),
  studentBirthdate: z.string().optional(),
  studentAge: z.coerce.number().min(0).max(18).optional(),
  studentGender: z.string().optional(),
  parentFullname: z.string().min(2, 'Parent name is required'),
  parentEmail: z.string().email('Valid parent email is required'),
  parentPhone: z.string().min(7, 'Phone is required'),
  preferredProgram: z.string().min(1, 'Select a program'),
});

export const paymentSchema = z.object({
  studentId: z.string().min(1),
  amount: z.coerce.number().positive(),
  paymentMethod: z.string().min(1),
  paymentStatus: z.string().min(1),
});

export const attendanceSchema = z.object({
  studentId: z.string().optional(),
  employeeId: z.string().optional(),
  classId: z.string().optional(),
  attendanceDate: z.string().min(1),
  status: z.string().min(1),
  kind: z.string().min(1),
});
