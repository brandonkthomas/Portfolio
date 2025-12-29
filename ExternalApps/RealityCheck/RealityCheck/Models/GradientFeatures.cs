namespace RealityCheck.Models;

/// <summary>
/// Captures gradient statistics derived from an image.
/// </summary>
public sealed class GradientFeatures
{
    public GradientFeatures(
        double lambda1,
        double lambda2,
        double isotropyRatio,
        double energy,
        int sampleCount,
        int width,
        int height)
    {
        Lambda1 = lambda1;
        Lambda2 = lambda2;
        IsotropyRatio = isotropyRatio;
        Energy = energy;
        SampleCount = sampleCount;
        Width = width;
        Height = height;
    }

    /// <summary>Largest eigenvalue of the gradient covariance matrix.</summary>
    public double Lambda1 { get; }

    /// <summary>Smallest eigenvalue of the gradient covariance matrix.</summary>
    public double Lambda2 { get; }

    /// <summary>Lambda2 / Lambda1; closer to 1 means gradients are more isotropic.</summary>
    public double IsotropyRatio { get; }

    /// <summary>Total gradient energy (Lambda1 + Lambda2).</summary>
    public double Energy { get; }

    /// <summary>Number of gradient samples used.</summary>
    public int SampleCount { get; }

    /// <summary>Processed image width.</summary>
    public int Width { get; }

    /// <summary>Processed image height.</summary>
    public int Height { get; }
}
