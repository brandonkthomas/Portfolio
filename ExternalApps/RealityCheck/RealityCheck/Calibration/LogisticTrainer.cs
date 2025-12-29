using System.Globalization;
using RealityCheck.Models;

namespace RealityCheck.Calibration;

public static class LogisticTrainer
{
    // ============================================================================================
    /// <summary>
    /// Train a logistic scorer from a CSV produced by the console app.
    /// Labels: uses label/target/class column if present (1 = AI), otherwise infers from filename containing "-ai." or "FAKE".
    /// </summary>
    public static LogisticAiScorer TrainFromCsv(string csvPath, int epochs = 4000, double learningRate = 0.1)
    {
        var samples = new List<FeatureSample>();
        using var reader = new StreamReader(csvPath);
        var header = reader.ReadLine();
        if (header is null)
        {
            throw new InvalidOperationException("Empty CSV");
        }

        var indices = ParseHeader(header);
        string? line;
        while ((line = reader.ReadLine()) is not null)
        {
            var parts = SplitCsv(line);
            var file = parts[indices.File];

            var hasLabel = indices.Label.HasValue;
            var isAi = hasLabel
                ? int.Parse(parts[indices.Label!.Value], CultureInfo.InvariantCulture) == 1
                : InferAiFromName(file);

            var isotropy = double.Parse(parts[indices.Score], CultureInfo.InvariantCulture);
            var energy = double.Parse(parts[indices.Energy], CultureInfo.InvariantCulture);
            samples.Add(new FeatureSample(isotropy, energy, isAi, file));
        }

        return LogisticAiScorer.Train(samples, epochs, learningRate);
    }

    // ============================================================================================
    /// <summary>
    /// Parses the header of a CSV file.
    /// </summary>
    /// <param name="headerLine">The header line to parse.</param>
    /// <returns>The parsed header.</returns>
    private static (int File, int Score, int Energy, int? Label) ParseHeader(string headerLine)
    {
        var headers = SplitCsv(headerLine);
        int fileIdx = Array.IndexOf(headers, "file");
        int scoreIdx = Array.IndexOf(headers, "score");
        if (scoreIdx < 0) scoreIdx = Array.IndexOf(headers, "iso"); // console CSV uses iso
        if (scoreIdx < 0) scoreIdx = Array.IndexOf(headers, "combined"); // fallback if only combined is present
        int energyIdx = Array.IndexOf(headers, "energy");
        int labelIdx = Array.IndexOf(headers, "label");
        if (labelIdx < 0) labelIdx = Array.IndexOf(headers, "target");
        if (labelIdx < 0) labelIdx = Array.IndexOf(headers, "class");

        if (fileIdx < 0 || scoreIdx < 0 || energyIdx < 0)
        {
            throw new InvalidOperationException("CSV must contain columns: file, (score|iso|combined), energy");
        }
        return (fileIdx, scoreIdx, energyIdx, labelIdx >= 0 ? labelIdx : (int?)null);
    }

    // ============================================================================================
    /// <summary>
    /// Splits a CSV line into an array of fields.
    /// </summary>
    /// <param name="line">The line to split.</param>
    /// <returns>The array of fields.</returns>
    private static string[] SplitCsv(string line)
    {
        var fields = new List<string>();
        var sb = new System.Text.StringBuilder();
        var inQuotes = false;
        for (var i = 0; i < line.Length; i++)
        {
            var c = line[i];
            if (c == '\"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '\"')
                {
                    sb.Append('\"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (c == ',' && !inQuotes)
            {
                fields.Add(sb.ToString());
                sb.Clear();
            }
            else
            {
                sb.Append(c);
            }
        }
        fields.Add(sb.ToString());
        return fields.ToArray();
    }

    // ============================================================================================
    /// <summary>
    /// Infers whether a file is AI-generated based on its name.
    /// </summary>
    /// <param name="file">The name of the file to check.</param>
    /// <returns>True if the file is AI-generated, false otherwise.</returns>
    private static bool InferAiFromName(string file)
    {
        var lower = file.ToLowerInvariant();
        return lower.Contains("-ai.") || lower.Contains("/fake/") || lower.Contains("\\fake\\");
    }
}
