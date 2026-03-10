/**
 * @file Upload controller — S3 presigned URL generation.
 */
const { generatePresignedUpload } = require("../utils/awsS3Service");
const { success, error } = require("../utils/response");

/**
 * POST /upload/presigned-url
 * Body: { folder, fileName, contentType }
 * Returns: { uploadUrl, cdnUrl }
 */
async function getPresignedUrl(req, res, next) {
  try {
    const { folder, fileName, contentType } = req.body;

    if (!folder || !fileName || !contentType) {
      return error(res, {
        statusCode: 400,
        message: "folder, fileName, and contentType are required",
      });
    }

    const allowedFolders = ["logos", "covers", "products", "profiles", "misc"];
    if (!allowedFolders.includes(folder)) {
      return error(res, {
        statusCode: 400,
        message: `folder must be one of: ${allowedFolders.join(", ")}`,
      });
    }

    const result = await generatePresignedUpload({
      bucket: process.env.AWS_S3_BUCKET,
      folder,
      fileName,
      contentType,
      cloudfrontDomain: process.env.CLOUDFRONT_DOMAIN,
    });

    return success(res, {
      message: "Presigned URL generated",
      data: {
        uploadUrl: result.uploadUrl,
        cdnUrl: result.cdnUrl,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPresignedUrl };
