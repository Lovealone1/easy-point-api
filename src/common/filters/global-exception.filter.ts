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
import * as crypto from 'crypto';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new AppLogger();

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    const traceId = crypto.randomUUID().split('-')[0];

    if (exception instanceof AppError) {
      this.logger.warn(`[Domain Error] [TraceID: ${traceId}] ${exception.errorCode}: ${exception.message}`);
      
      const payloadDetails = exception.details ? { ...exception.details, traceId } : { traceId };

      return response.status(exception.httpStatus).json({
        success: false,
        error: {
          code: exception.errorCode,
          message: exception.message,
          details: payloadDetails,
        },
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse: any = exception.getResponse();
      
      const isFavicon = request.url.includes('favicon.ico');
      
      if (!isFavicon) {
        this.logger.warn(`[Validation Error] [TraceID: ${traceId}] HTTP ${status}: ${exceptionResponse.message || exception.message}`);
      }

      return response.status(status).json({
        success: false,
        error: {
          code: status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR',
          message: exceptionResponse.message || exception.message,
          details: { traceId },
        },
      });
    }

    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    
    this.logger.error(
      `[Unhandled Exception] [TraceID: ${traceId}] ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    return response.status(status).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error occurred.',
        details: { traceId },
      },
    });
  }
}
