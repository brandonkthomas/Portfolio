using System.Collections.Concurrent;

namespace Portfolio.Services;

public static class PhotoManifestGenerator
{
    //==============================================================================================
    // Private properties
    //==============================================================================================

    /// <summary>
    /// Dimension cache
    /// </summary>
    private static readonly ConcurrentDictionary<string, (int Width, int Height)> DimensionCache = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Supported extensions
    /// </summary>
    private static readonly HashSet<string> SupportedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".gif"
    };

    /// <summary>
    /// Default width
    /// </summary>
    private const int DefaultWidth = 1000;

    /// <summary>
    /// Default height
    /// </summary>
    private const int DefaultHeight = 1500;

    //==============================================================================================
    /// <summary>
    /// Build the photo manifest entries
    /// </summary>
    /// <param name="rootPath">The root path of the photo store</param>
    /// <param name="requestPrefix">The request prefix</param>
    /// <returns>The photo manifest entries</returns>
    public static IReadOnlyList<PhotoManifestEntry> BuildEntries(string rootPath, string requestPrefix)
    {
        if (string.IsNullOrWhiteSpace(rootPath) || !Directory.Exists(rootPath))
        {
            return Array.Empty<PhotoManifestEntry>();
        }

        var prefix = NormalizePrefix(requestPrefix);

        var entries = Directory.EnumerateFiles(rootPath, "*.*", SearchOption.AllDirectories)
            .Where(path => SupportedExtensions.Contains(Path.GetExtension(path)))
            .Select(path =>
            {
                var relative = Path.GetRelativePath(rootPath, path).Replace("\\", "/");
                var url = prefix + relative;
                var (width, height) = GetDimensions(path);
                return new PhotoManifestEntry(url, width, height);
            })
            .ToList();

        entries.Sort((a, b) => StringComparer.OrdinalIgnoreCase.Compare(
            NormalizeForSort(a.Url),
            NormalizeForSort(b.Url)));

        return entries;
    }

    //==============================================================================================
    /// <summary>
    /// Normalize a prefix
    /// </summary>
    /// <param name="prefix">The prefix to normalize</param>
    /// <returns>The normalized prefix</returns>
    private static string NormalizePrefix(string? prefix)
    {
        if (string.IsNullOrWhiteSpace(prefix))
        {
            return "/";
        }

        return prefix.EndsWith("/", StringComparison.Ordinal) ? prefix : prefix + "/";
    }

    //==============================================================================================
    /// <summary>
    /// Get the dimensions of an image file
    /// </summary>
    /// <param name="filePath">The path to the image file</param>
    /// <returns>The dimensions of the image</returns>
    private static (int Width, int Height) GetDimensions(string filePath)
    {
        try
        {
            return DimensionCache.GetOrAdd(filePath, static path =>
            {
                if (ImageDimensionReader.TryGetDimensions(path, out var width, out var height))
                {
                    return (Math.Max(1, width), Math.Max(1, height));
                }

                return (DefaultWidth, DefaultHeight);
            });
        }
        catch
        {
            return (DefaultWidth, DefaultHeight);
        }
    }

    //==============================================================================================
    /// <summary>
    /// Normalize a string for sorting
    /// </summary>
    /// <param name="input">The string to normalize</param>
    /// <returns>The normalized string</returns>
    private static string NormalizeForSort(string input)
    {
        if (string.IsNullOrEmpty(input))
        {
            return string.Empty;
        }

        var builder = new System.Text.StringBuilder(input.Length * 2);
        var i = 0;
        while (i < input.Length)
        {
            if (char.IsDigit(input[i]))
            {
                var j = i;
                while (j < input.Length && char.IsDigit(input[j]))
                {
                    j++;
                }

                var segment = input.Substring(i, j - i);
                builder.Append(segment.PadLeft(20, '0'));
                i = j;
            }
            else
            {
                builder.Append(input[i]);
                i++;
            }
        }

        return builder.ToString();
    }
}

public record PhotoManifestEntry(string Url, int Width, int Height);
