using RealityCheck.Models;
using RealityCheck.Calibration;

namespace RealityCheck;

/// <summary>
/// Scores images using gradient PCA features and a configurable threshold.
/// Higher isotropy (ratio closer to 1) is treated as more AI-like by default.
/// </summary>
public sealed class AiDetector
{
    private readonly GradientFeatureExtractor _extractor;
    private readonly DetectionOptions _defaults;
    private readonly LogisticAiScorer? _logistic;

    public AiDetector(GradientFeatureExtractor? extractor = null, DetectionOptions? defaults = null, LogisticAiScorer? logistic = null)
    {
        _extractor = extractor ?? new GradientFeatureExtractor();
        _defaults = defaults ?? new DetectionOptions();
        _logistic = logistic;
    }

    // ============================================================================================
    /// <summary>
    /// Detects if an image is AI-generated using gradient PCA features and a configurable threshold.
    /// </summary>
    /// <param name="imagePath">The path to the image to detect.</param>
    /// <param name="overrideOptions">The options to use for the detection.</param>
    /// <returns>The detection result.</returns>
    public DetectionResult Detect(string imagePath, DetectionOptions? overrideOptions = null)
    {
        var options = MergeOptions(_defaults, overrideOptions);
        var features = _extractor.Extract(imagePath);

        var notes = string.Empty;
        if (features.Energy < options.MinEnergy)
        {
            notes = "Low gradient energy; decision is less reliable.";
        }

        var iso = features.IsotropyRatio;
        var isoClamped = Math.Clamp(iso, 0.0, 1.0);
        double? prob = null;

        if (_logistic is not null)
        {
            prob = _logistic.PredictProbability(features);
        }

        double combinedScore;
        double thresholdUsed;
        if (prob.HasValue)
        {
            var w = Math.Clamp(options.CombinedLogisticWeight, 0.0, 1.0);
            combinedScore = w * prob.Value + (1 - w) * isoClamped;
            thresholdUsed = options.CombinedThreshold;
        }
        else
        {
            combinedScore = isoClamped;
            thresholdUsed = options.IsotropyThreshold;
        }

        var isAi = combinedScore >= thresholdUsed && features.Energy >= options.MinEnergy;
        var finalNotes = prob.HasValue ? $"{notes} logistic+isotropy fused" : notes;
        return new DetectionResult(isAi, combinedScore, thresholdUsed, features, iso, prob, finalNotes);
    }

    // ============================================================================================
    /// <summary>
    /// Merges the default options with the override options.
    /// </summary>
    /// <param name="defaults">The default options.</param>
    /// <param name="overrides">The override options.</param>
    /// <returns>The merged options.</returns>
    private static DetectionOptions MergeOptions(DetectionOptions defaults, DetectionOptions? overrides) =>
        overrides is null
            ? defaults
            : new DetectionOptions
            {
                IsotropyThreshold = overrides.IsotropyThreshold,
                MinEnergy = overrides.MinEnergy,
                ProbabilityThreshold = overrides.ProbabilityThreshold,
                CombinedThreshold = overrides.CombinedThreshold,
                CombinedLogisticWeight = overrides.CombinedLogisticWeight
            };
}
