namespace RealityCheck.Models;

public sealed class DetectionResult
{
    public DetectionResult(
        bool isLikelyAi,
        double combinedScore,
        double thresholdUsed,
        GradientFeatures features,
        double isotropyScore,
        double? logisticProbability,
        string? notes = null)
    {
        IsLikelyAi = isLikelyAi;
        Score = combinedScore;
        ThresholdUsed = thresholdUsed;
        Features = features;
        IsotropyScore = isotropyScore;
        LogisticProbability = logisticProbability;
        Notes = notes;
    }

    /// <summary>True when the image is predicted to be AI-generated.</summary>
    public bool IsLikelyAi { get; }

    /// <summary>The combined scalar score (currently average of isotropy and logistic probability when available).</summary>
    public double Score { get; }

    /// <summary>Isotropy-only score.</summary>
    public double IsotropyScore { get; }

    /// <summary>Logistic probability if a logistic model was used; otherwise null.</summary>
    public double? LogisticProbability { get; }

    /// <summary>The threshold used for the decision (combined threshold when logistic is used; otherwise isotropy threshold).</summary>
    public double ThresholdUsed { get; }

    /// <summary>Underlying gradient features.</summary>
    public GradientFeatures Features { get; }

    /// <summary>Optional human-readable notes (e.g., low energy warning).</summary>
    public string? Notes { get; }
}
