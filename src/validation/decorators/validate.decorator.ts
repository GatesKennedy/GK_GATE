import { UsePipes } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { ZodValidationPipe } from '../zod-validation.pipe';

export const ValidateBody = (schema: ZodSchema) => 
  UsePipes(new ZodValidationPipe(schema));

export const ValidateParams = (schema: ZodSchema) => 
  UsePipes(new ZodValidationPipe(schema));

export const ValidateQuery = (schema: ZodSchema) => 
  UsePipes(new ZodValidationPipe(schema));