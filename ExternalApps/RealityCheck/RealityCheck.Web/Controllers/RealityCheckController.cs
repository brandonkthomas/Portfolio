using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using RealityCheck.Web.Services;
using RealityCheck;

namespace RealityCheck.Web.Controllers;

// ============================================================================================
/// <summary>
/// Controller for the RealityCheck API and landing page.
/// </summary>
[ApiController]
public class RealityCheckController(AiDetector detector) : Controller
{
    private const long MaxUploadBytes = 20L * 1024 * 1024; // 20 MB
    private const int MaxWidth = 12000;
    private const int MaxHeight = 12000;
    private const long MaxPixels = 40_000_000; // 40 megapixels

    // ============================================================================================
    /// <summary>
    /// Display the RealityCheck landing page.
    /// </summary>
    [HttpGet("/realitycheck")]
    public IActionResult Index()
    {
        ViewData["Title"] = "RealityCheck";
        ViewData["IsAppPage"] = true;

        // Explicit feature-folder view path so this module stays portable.
        return View("~/Apps/RealityCheck/Views/Index.cshtml");
    }

    // ============================================================================================
    /// <summary>
    /// Analyze an image file for AI content.
    /// </summary>
    [HttpPost("/api/realitycheck/analyze")]
    [RequestSizeLimit((int)MaxUploadBytes)]
    [EnableRateLimiting("realitycheck-upload")]
    public async Task<IActionResult> Analyze([FromForm] IFormFile? file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { error = "No file uploaded" });
        }

        // Defense-in-depth: don't rely solely on framework/body limits.
        if (file.Length > MaxUploadBytes)
        {
            return BadRequest(new { error = "File too large" });
        }

        var tempDir = Path.Combine(Path.GetTempPath(), "realitycheck");
        Directory.CreateDirectory(tempDir);

        var tempPath = Path.Combine(tempDir, $"{Guid.NewGuid():N}.upload");
        string? analyzedPath = null;

        await using (var stream = System.IO.File.Create(tempPath))
        {
            await file.CopyToAsync(stream, cancellationToken);
        }

        try
        {
            // Validate actual file content (magic bytes) and enforce safe format allowlist.
            if (!TryDetectImageExtensionFromFileHeader(tempPath, out var detectedExtension))
            {
                return BadRequest(new { error = "Unsupported or invalid image format. Allowed: JPEG, PNG, GIF, WebP." });
            }

            // Rename to a safe, detected extension (some decoders/logic key off extensions).
            analyzedPath = Path.Combine(tempDir, $"{Guid.NewGuid():N}{detectedExtension}");
            System.IO.File.Move(tempPath, analyzedPath);

            // Enforce dimensions / megapixels to mitigate decompression bombs / excessive compute.
            if (!ImageDimensionReader.TryGetDimensions(analyzedPath, out var width, out var height))
            {
                return BadRequest(new { error = "Could not read image dimensions" });
            }

            if (width <= 0 || height <= 0 || width > MaxWidth || height > MaxHeight || (long)width * height > MaxPixels)
            {
                return BadRequest(new
                {
                    error = "Image dimensions too large",
                    maxWidth = MaxWidth,
                    maxHeight = MaxHeight,
                    maxPixels = MaxPixels
                });
            }

            var result = detector.Detect(analyzedPath);
            return Ok(new
            {
                isLikelyAi = result.IsLikelyAi,
                score = result.Score,
                thresholdUsed = result.ThresholdUsed,
                isotropyScore = result.IsotropyScore,
                logisticProbability = result.LogisticProbability,
                notes = result.Notes,
                features = new
                {
                    lambda1 = result.Features.Lambda1,
                    lambda2 = result.Features.Lambda2,
                    isotropyRatio = result.Features.IsotropyRatio,
                    energy = result.Features.Energy,
                    sampleCount = result.Features.SampleCount,
                    width = result.Features.Width,
                    height = result.Features.Height
                }
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Failed to analyze image", detail = ex.Message });
        }
        finally
        {
            try { if (System.IO.File.Exists(tempPath)) System.IO.File.Delete(tempPath); } catch { /* ignore */ }
            try { if (analyzedPath is not null && System.IO.File.Exists(analyzedPath)) System.IO.File.Delete(analyzedPath); } catch { /* ignore */ }
        }
    }

    // ============================================================================================
    /// <summary>
    /// Detect the extension of an image file from its header.
    /// </summary>
    private static bool TryDetectImageExtensionFromFileHeader(string filePath, out string extension)
    {
        extension = string.Empty;

        try
        {
            Span<byte> header = stackalloc byte[12];
            using var fs = System.IO.File.OpenRead(filePath);
            var read = fs.Read(header);
            if (read < 12)
            {
                return false;
            }

            // PNG: 89 50 4E 47 0D 0A 1A 0A
            if (header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47 &&
                header[4] == 0x0D && header[5] == 0x0A && header[6] == 0x1A && header[7] == 0x0A)
            {
                extension = ".png";
                return true;
            }

            // GIF: "GIF87a" / "GIF89a"
            if (header[0] == (byte)'G' && header[1] == (byte)'I' && header[2] == (byte)'F' &&
                header[3] == (byte)'8' && (header[4] == (byte)'7' || header[4] == (byte)'9') && header[5] == (byte)'a')
            {
                extension = ".gif";
                return true;
            }

            // JPEG: FF D8
            if (header[0] == 0xFF && header[1] == 0xD8)
            {
                extension = ".jpg";
                return true;
            }

            // WebP: "RIFF" .... "WEBP"
            if (header[0] == (byte)'R' && header[1] == (byte)'I' && header[2] == (byte)'F' && header[3] == (byte)'F' &&
                header[8] == (byte)'W' && header[9] == (byte)'E' && header[10] == (byte)'B' && header[11] == (byte)'P')
            {
                extension = ".webp";
                return true;
            }

            return false;
        }
        catch
        {
            return false;
        }
    }
}
