  const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
  const multer = require("multer");
  const multerS3 = require("multer-s3");
  const crypto = require("crypto");
  const path = require("path");
    const { validateAndOptimizeImage } = require('../../utils/imageProcessor');

  const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const hasS3Config = Boolean(
    process.env.AWS_REGION
    && process.env.AWS_ACCESS_KEY_ID
    && process.env.AWS_SECRET_ACCESS_KEY
    && process.env.S3_BUCKET_NAME
  );

  const uploadBufferToS3 = async (buffer, folder, fileType) => {
  if (!hasS3Config) {
    throw new Error('Missing S3 configuration. Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and S3_BUCKET_NAME.');
  }

  const filename = crypto.randomBytes(16).toString("hex") + '.jpg'; // Always save as jpg after optimization
  const key = `${folder}/${filename}`;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: 'image/jpeg', // The optimized image is a JPEG
  });

  await s3.send(command);
  return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};

  const uploadInMemory = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 1024 * 1024 * 5, // 5MB limit per file
    fieldSize: 1024 * 1024 * 5, // 5MB field size
    fields: 100, // Max number of non-file fields
    files: 100 // Max number of file fields (increased to allow many images across variants)
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error('Invalid file type. Only JPEG and PNG images are allowed.'), false);
      return;
    }
    cb(null, true);
  }
});

  // Enhanced profile picture upload with optimization
  const createProductImageUpload = () => {
    if (!hasS3Config) {
      return uploadInMemory;
    }

    return multer({
    storage: multerS3({
      s3: s3,
      bucket: process.env.S3_BUCKET_NAME,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: async function (req, file, cb) {
        try {
          // Process the image before uploading
          const buffer = file.buffer;
          const optimizedBuffer = await validateAndOptimizeImage(buffer);
          
          // Generate unique filename
          const filename = crypto.randomBytes(16).toString('hex') + '.jpg';
          const key = `product-images/${filename}`;
          
          // Attach the optimized buffer to the file object
          file.buffer = optimizedBuffer;
          
          cb(null, key);
        } catch (error) {
          cb(error);
        }
      },
      body: async function(req, file, cb) {
        // Return the optimized buffer for upload
        cb(null, file.buffer);
      }
    }),
    limits: { fileSize: 1024 * 1024 * 5 }, // 5MB limit
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.mimetype)) {
        cb(new Error('Invalid file type. Only JPEG and PNG images are allowed.'), false);
        return;
      }
      cb(null, true);
    }
  });
  };

  const uploadProductImage = createProductImageUpload();


  module.exports = {
    uploadInMemory,
    uploadBufferToS3,
    uploadProductImage,
  };
