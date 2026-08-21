import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const isProduction = process.env.NODE_ENV === 'production';
    const exceptionResponse: any =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: isProduction ? 'Internal server error' : (exception?.message || 'Internal server error') };

    let message = exceptionResponse.message || exceptionResponse;
    let errors: any[] | null = null;

    if (Array.isArray(message)) {
      errors = message;
      message = 'Validation failed';
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
