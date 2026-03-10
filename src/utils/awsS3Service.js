/**
 * @file AWS S3 presigned URL generation using AWS SDK v3.
 * Private bucket + CloudFront CDN for reads.
 */
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

let s3Client = null;

/**
 * Initialize the S3 client.
 * @param {object} config
 * @param {string} config.region
 * @param {string} config.accessKeyId
 * @param {string} config.secretAccessKey
 * @returns {S3Client}
 */
function initS3({ region, accessKeyId, secretAccessKey }) {
  const clientConfig = { region };

  // If explicit credentials provided, use them; otherwise fall back to IAM role
  if (accessKeyId && secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId,
      secretAccessKey,
    };
  }

  s3Client = new S3Client(clientConfig);
  return s3Client;
}

/**
 * Generate a presigned upload URL (15 min expiry).
 * @param {object} options
 * @param {string} options.bucket - S3 bucket name
 * @param {string} options.folder - Folder prefix (e.g. 'logos', 'products', 'covers')
 * @param {string} options.fileName - Original file name
 * @param {string} options.contentType - MIME type
 * @param {string} options.cloudfrontDomain - CloudFront domain for CDN URL
 * @returns {Promise<{uploadUrl: string, cdnUrl: string, key: string}>}
 */
async function generatePresignedUpload({
  bucket,
  folder,
  fileName,
  contentType,
  cloudfrontDomain,
}) {
  const ext = path.extname(fileName);
  const key = `${folder}/${uuidv4()}${ext}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 min
  const cdnUrl = `https://${cloudfrontDomain}/${key}`;

  return { uploadUrl, cdnUrl, key };
}

/**
 * Generate a presigned read URL (7 days expiry) — fallback when CloudFront is not set up.
 * @param {object} options
 * @param {string} options.bucket
 * @param {string} options.key
 * @returns {Promise<string>}
 */
async function generatePresignedRead({ bucket, key }) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: 604800 }); // 7 days
}

module.exports = { initS3, generatePresignedUpload, generatePresignedRead };
