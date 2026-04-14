import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppError } from '../exceptions/base.error';
import { AppLogger } from '../logger/app.logger';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new AppLogger();

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof AppError) {
      this.logger.warn(`[Domain Error] ${exception.errorCode}: ${exception.message}`);
      
      return response.status(exception.httpStatus).json({
        success: false,
        error: {
          code: exception.errorCode,
          message: exception.message,
          details: exception.details || null,
        },
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse: any = exception.getResponse();
      
      return response.status(status).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: exceptionResponse.message || exception.message,
          details: null,
        },
      });
    }

    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    
    this.logger.error(
      `[Unhandled Exception] ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    return response.status(status).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error occurred.',
        details: null,
      },
    });
  }
}
