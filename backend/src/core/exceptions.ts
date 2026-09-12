export class AppError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  statusCode = 404;
}

export class InvalidTransitionError extends AppError {
  statusCode = 409;
}

export class InsufficientStockError extends AppError {
  statusCode = 409;
}

export class ValidationError extends AppError {
  statusCode = 422;
}
