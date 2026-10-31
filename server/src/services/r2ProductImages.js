const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

function createR2Uploader(env = process.env, Client = S3Client) {
  const required = ['R2_ENDPOINT', 'R2_BUCKET', 'R2_PUBLIC_URL', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
  if (required.some(key => !env[key]?.trim())) {
    throw new Error('R2 chưa được cấu hình đầy đủ trên server');
  }
  const endpoint = new URL(env.R2_ENDPOINT);
  const publicUrl = new URL(env.R2_PUBLIC_URL);
  if (endpoint.protocol !== 'https:' || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(endpoint.hostname)
      || endpoint.pathname !== '/' || endpoint.search || endpoint.hash || endpoint.username || endpoint.password
      || publicUrl.protocol !== 'https:' || publicUrl.search || publicUrl.hash || publicUrl.username || publicUrl.password) {
    throw new Error('Địa chỉ R2 không hợp lệ; endpoint không được chứa tên bucket');
  }
  const client = new Client({
    region: 'auto', endpoint: endpoint.origin,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    maxAttempts: 3,
    requestHandler: { connectionTimeout: 5000, requestTimeout: 30000 }
  });
  const baseUrl = publicUrl.href.replace(/\/+$/, '');
  return async function upload(key, bytes, contentType) {
    await client.send(new PutObjectCommand({
      Bucket: env.R2_BUCKET, Key: key, Body: bytes,
      ContentType: contentType, ContentLength: bytes.length,
      CacheControl: 'public, max-age=31536000, immutable'
    }));
    return `${baseUrl}/${key}`;
  };
}

module.exports = { createR2Uploader };
