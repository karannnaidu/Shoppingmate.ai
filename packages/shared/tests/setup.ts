// Provide required env vars so envalid does not exit during test collection.
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.S3_ENDPOINT ??= 'https://s3.test';
process.env.S3_ACCESS_KEY_ID ??= 'test-key-id';
process.env.S3_SECRET_ACCESS_KEY ??= 'test-secret';
process.env.S3_BUCKET ??= 'test-bucket';
