const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const path = require("path");

// ── S3 Client (Railway bucket env vars) ───────────────────────────────────────
const s3 = new S3Client({
  region: process.env.REGION || "auto",
  endpoint: process.env.ENDPOINT,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
  forcePathStyle: true, // required for S3-compatible endpoints
});

const BUCKET = process.env.BUCKET;

/**
 * Upload a file buffer to S3.
 * @param {Express.Multer.File} file  - multer file object (memory storage)
 * @returns {Promise<{ url: string, key: string }>}
 */
async function uploadToS3(file) {
  const ext = path.extname(file.originalname);
  const key = `uploads/${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`;

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    },
  });

  await upload.done();

  // Build the public URL from the endpoint + bucket + key
  const endpoint = process.env.ENDPOINT
    ? process.env.ENDPOINT.replace(/\/$/, "")
    : `https://s3.${process.env.REGION}.amazonaws.com`;
  const url = `${endpoint}/${BUCKET}/${key}`;

  return { url, key };
}

/**
 * Delete an object from S3 by its key.
 * @param {string} key - the S3 object key (e.g. "uploads/123456_789.jpg")
 */
async function deleteFromS3(key) {
  if (!key) return;
  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}

module.exports = { uploadToS3, deleteFromS3 };
