/**
 * Unit tests for utils/imageProcessor.js
 * Tests image validation and optimization
 */
const { imageSize } = require('image-size');
const sharp = require('sharp');

jest.mock('image-size');
jest.mock('sharp');

const { validateAndOptimizeImage } = require('../../utils/imageProcessor');

describe('validateAndOptimizeImage', () => {
    let mockSharpInstance;

    beforeEach(() => {
        mockSharpInstance = {
            resize: jest.fn().mockReturnThis(),
            jpeg: jest.fn().mockReturnThis(),
            toBuffer: jest.fn().mockResolvedValue(Buffer.from('optimized')),
        };
        sharp.mockReturnValue(mockSharpInstance);
    });

    it('should reject images smaller than 200x200', async () => {
        imageSize.mockReturnValue({ width: 100, height: 100 });
        await expect(validateAndOptimizeImage(Buffer.from('test')))
            .rejects.toThrow('Image dimensions must be at least 200x200 pixels');
    });

    it('should reject images larger than 4000x4000', async () => {
        imageSize.mockReturnValue({ width: 5000, height: 3000 });
        await expect(validateAndOptimizeImage(Buffer.from('test')))
            .rejects.toThrow('Image dimensions cannot exceed 4000x4000 pixels');
    });

    it('should optimize valid images', async () => {
        imageSize.mockReturnValue({ width: 800, height: 800 });
        const result = await validateAndOptimizeImage(Buffer.from('test'));
        expect(sharp).toHaveBeenCalled();
        expect(mockSharpInstance.resize).toHaveBeenCalledWith(800, 800, {
            fit: 'cover',
            withoutEnlargement: true,
        });
        expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ quality: 80, progressive: true });
        expect(result).toEqual(Buffer.from('optimized'));
    });

    it('should accept images at minimum boundary (200x200)', async () => {
        imageSize.mockReturnValue({ width: 200, height: 200 });
        const result = await validateAndOptimizeImage(Buffer.from('test'));
        expect(result).toEqual(Buffer.from('optimized'));
    });

    it('should accept images at maximum boundary (4000x4000)', async () => {
        imageSize.mockReturnValue({ width: 4000, height: 4000 });
        const result = await validateAndOptimizeImage(Buffer.from('test'));
        expect(result).toEqual(Buffer.from('optimized'));
    });
});
