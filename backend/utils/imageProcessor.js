const { imageSize } = require('image-size');
const sharp = require('sharp');

const validateAndOptimizeImage = async (buffer) => {
  // Get image dimensions
  const dimensions = imageSize(buffer);

  // Validate minimum dimensions (e.g., 200x200 pixels)
  if (dimensions.width < 200 || dimensions.height < 200) {
    throw new Error('Image dimensions must be at least 200x200 pixels');
  }

  // Validate maximum dimensions (e.g., 4000x4000 pixels)
  if (dimensions.width > 4000 || dimensions.height > 4000) {
    throw new Error('Image dimensions cannot exceed 4000x4000 pixels');
  }

  // Optimize the image
  const optimizedBuffer = await sharp(buffer)
    .resize(800, 800, {
      fit: 'cover',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80, progressive: true })
    .toBuffer();

  return optimizedBuffer;
};

module.exports = { validateAndOptimizeImage };
