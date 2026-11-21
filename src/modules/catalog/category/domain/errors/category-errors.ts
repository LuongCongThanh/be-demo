export class CategorySlugConflictError extends Error {
  constructor() {
    super('Category slug already exists');
    this.name = 'CategorySlugConflictError';
  }
}
