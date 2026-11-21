export abstract class CategoryDomainError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class CategoryInvalidInputError extends CategoryDomainError {
  constructor(message: string) {
    super(message);
  }
}

export class CategoryConflictError extends CategoryDomainError {
  constructor(message: string) {
    super(message);
  }
}

export class CategoryNotFoundError extends CategoryDomainError {
  constructor(message: string) {
    super(message);
  }
}

export class CategoryImageUploadError extends CategoryDomainError {
  constructor(message: string) {
    super(message);
  }
}

export class CategorySlugConflictError extends CategoryConflictError {
  constructor() {
    super('Category slug already exists');
  }
}
