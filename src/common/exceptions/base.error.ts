export abstract class AppError extends Error {
  public readonly message: string;
  public readonly httpStatus: number;
  public readonly errorCode: string;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    httpStatus: number,
    errorCode: string,
    details?: Record<string, any>,
  ) {
    super(message);
    
    Object.setPrototypeOf(this, new.target.prototype);
    
    this.name = this.constructor.name;
    this.message = message;
    this.httpStatus = httpStatus;
    this.errorCode = errorCode;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}
