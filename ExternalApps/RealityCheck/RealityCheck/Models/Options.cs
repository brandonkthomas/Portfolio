namespace RealityCheck.Models;

public sealed class FeatureExtractionOptions
{
    /// <summary>Resize the longer side to this value (preserving aspect). Set 0 to skip.</summary>
    public int MaxDimension { get; init; } = 768;

    /// <summary>Stride for sampling pixels. 1 uses every pixel; >1 subsamples for speed.</summary>
    public int Stride { get; init; } = 1;
}

public sealed class DetectionOptions
{
    /// <summary>Isotropy ratio threshold. Higher means stricter AI flagging.</summary>
    public double IsotropyThreshold { get; init; } = 0.54;

    /// <summary>Minimum energy required to trust the decision (helps reject blank/flat images).</summary>
    public double MinEnergy { get; init; } = 1e-4;

    /// <summary>Probability threshold when using the logistic scorer.</summary>
    public double ProbabilityThreshold { get; init; } = 0.5;

    /// <summary>Combined threshold when isotropy and logistic are fused.</summary>
    public double CombinedThreshold { get; init; } = 0.00005;

    /// <summary>Weight for logistic in the fused score (1 = logistic only, 0 = isotropy only).</summary>
    public double CombinedLogisticWeight { get; init; } = 1.0;
}
