using MathNet.Numerics.LinearAlgebra;
using RealityCheck.Models;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace RealityCheck;

/// <summary>
/// Computes gradient covariance and PCA-derived features from an image.
/// </summary>
public sealed class GradientFeatureExtractor
{
    private readonly FeatureExtractionOptions _options;

    // ============================================================================================
    /// <summary>
    /// Initializes a new instance of the GradientFeatureExtractor class.
    /// </summary>
    /// <param name="options">The options to use for the feature extraction.</param>
    public GradientFeatureExtractor(FeatureExtractionOptions? options = null)
    {
        _options = options ?? new FeatureExtractionOptions();
    }

    // ============================================================================================
    /// <summary>
    /// Extracts gradient features from an image.
    /// </summary>
    /// <param name="imagePath">The path to the image to extract features from.</param>
    /// <returns>The gradient features.</returns>
    public GradientFeatures Extract(string imagePath)
    {
        using var original = Image.Load<Rgba32>(imagePath);
        using var image = ResizeIfNeeded(original, _options.MaxDimension);

        var luminance = new double[image.Height, image.Width];
        image.ProcessPixelRows(accessor =>
        {
            for (var y = 0; y < accessor.Height; y++)
            {
                var row = accessor.GetRowSpan(y);
                for (var x = 0; x < accessor.Width; x++)
                {
                    luminance[y, x] = ToLuminance(row[x]);
                }
            }
        });

        const int margin = 1; // Sobel needs 1-pixel border
        var stride = Math.Max(1, _options.Stride);

        double sumXX = 0, sumXY = 0, sumYY = 0;
        var samples = 0;

        for (var y = margin; y < image.Height - margin; y += stride)
        {
            for (var x = margin; x < image.Width - margin; x += stride)
            {
                var gx =
                    -1 * luminance[y - 1, x - 1] + 1 * luminance[y - 1, x + 1] +
                    -2 * luminance[y, x - 1]     + 2 * luminance[y, x + 1]     +
                    -1 * luminance[y + 1, x - 1] + 1 * luminance[y + 1, x + 1];

                var gy =
                     1 * luminance[y - 1, x - 1] + 2 * luminance[y - 1, x] + 1 * luminance[y - 1, x + 1] +
                    -1 * luminance[y + 1, x - 1] - 2 * luminance[y + 1, x] - 1 * luminance[y + 1, x + 1];

                sumXX += gx * gx;
                sumXY += gx * gy;
                sumYY += gy * gy;
                samples++;
            }
        }

        if (samples == 0)
        {
            throw new InvalidOperationException("Image too small for gradient extraction.");
        }

        var invN = 1.0 / samples;
        var cov = Matrix<double>.Build.DenseOfArray(new[,]
        {
            { sumXX * invN, sumXY * invN },
            { sumXY * invN, sumYY * invN }
        });

        var evd = cov.Evd(Symmetricity.Symmetric);
        var eigenValues = evd.EigenValues.Select(v => v.Real).OrderByDescending(v => v).ToArray();
        var lambda1 = eigenValues.ElementAtOrDefault(0);
        var lambda2 = eigenValues.ElementAtOrDefault(1);
        var energy = lambda1 + lambda2;
        var isotropy = lambda1 <= 0 ? 0 : lambda2 / lambda1;

        return new GradientFeatures(lambda1, lambda2, isotropy, energy, samples, image.Width, image.Height);
    }

    // ============================================================================================
    /// <summary>
    /// Converts a pixel to its luminance value.
    /// </summary>
    /// <param name="pixel">The pixel to convert.</param>
    /// <returns>The luminance value.</returns>
    private static double ToLuminance(Rgba32 pixel) =>
        0.2126 * pixel.R / 255.0 +
        0.7152 * pixel.G / 255.0 +
        0.0722 * pixel.B / 255.0;

    // ============================================================================================
    /// <summary>
    /// Resizes an image if it is larger than the maximum dimension.
    /// </summary>
    /// <param name="image">The image to resize.</param>
    /// <param name="maxDim">The maximum dimension.</param>
    /// <returns>The resized image.</returns>
    private static Image<Rgba32> ResizeIfNeeded(Image<Rgba32> image, int maxDim)
    {
        if (maxDim <= 0 || (image.Width <= maxDim && image.Height <= maxDim))
        {
            return image.Clone();
        }

        var ratio = image.Width >= image.Height
            ? maxDim / (double)image.Width
            : maxDim / (double)image.Height;

        var newWidth = Math.Max(1, (int)Math.Round(image.Width * ratio));
        var newHeight = Math.Max(1, (int)Math.Round(image.Height * ratio));

        return image.Clone(ctx => ctx.Resize(newWidth, newHeight));
    }
}
