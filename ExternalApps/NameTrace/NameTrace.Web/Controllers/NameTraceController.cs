using Microsoft.AspNetCore.Mvc;

namespace NameTrace.Web.Controllers;

// ============================================================================================
/// <summary>
/// Controller for the NameTrace landing page and API.
/// </summary>
public class NameTraceController : Controller
{
    // ============================================================================================
    /// <summary>
    /// Display the NameTrace landing page.
    /// </summary>
    public IActionResult Index()
    {
        ViewData["Title"] = "NameTrace";

        // Inform the Portfolio host layout to avoid loading SPA-only scripts on this page.
        ViewData["IsAppPage"] = true;

        // Explicit feature-folder view path (keeps this module portable).
        return View("~/Apps/NameTrace/Views/Index.cshtml");
    }

    // ============================================================================================
    /// <summary>
    /// Request payload for a NameTrace lookup.
    /// </summary>
    public sealed record NameTraceLookupRequest(string Phone);

    /// <summary>
    /// Response payload for a NameTrace lookup.
    /// </summary>
    public sealed record NameTraceLookupResponse(string Phone, string? Name);

    // ============================================================================================
    /// <summary>
    /// Perform a reverse phone lookup using freecnam.org.
    /// </summary>
    [HttpPost("/api/nametrace/lookup")]
    public async Task<IActionResult> Lookup([FromBody] NameTraceLookupRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Phone))
        {
            return BadRequest(new { error = "Phone is required." });
        }

        var normalized = NormalizePhone(request.Phone);
        if (string.IsNullOrEmpty(normalized))
        {
            return BadRequest(new { error = "Invalid phone number." });
        }

        try
        {
            using var http = new HttpClient();

            var url = $"https://freecnam.org/dip?q={Uri.EscapeDataString(normalized)}";
            using var resp = await http.GetAsync(url, cancellationToken);

            if (!resp.IsSuccessStatusCode)
            {
                var detail = await resp.Content.ReadAsStringAsync(cancellationToken);
                return StatusCode((int)resp.StatusCode, new { error = "Lookup failed.", detail });
            }

            var content = await resp.Content.ReadAsStringAsync(cancellationToken);
            string? name = null;

            if (!string.IsNullOrWhiteSpace(content))
            {
                // freecnam returns plain text
                // On success, this should be a standard 15-character CNAM field
                name = FormatCnamName(content);
            }

            var response = new NameTraceLookupResponse(normalized, name);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Lookup failed.", detail = ex.Message });
        }
    }

    // ============================================================================================
    /// <summary>
    /// Normalize a phone number to a compact format: optional leading '+' then digits only.
    /// </summary>
    private static string NormalizePhone(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return string.Empty;
        }

        raw = raw.Trim();
        var result = new System.Text.StringBuilder(raw.Length);
        var hasPlus = false;

        foreach (var ch in raw)
        {
            if (ch == '+' && !hasPlus && result.Length == 0)
            {
                result.Append('+');
                hasPlus = true;
            }
            else if (char.IsDigit(ch))
            {
                result.Append(ch);
            }
        }

        if (result.Length == 0)
        {
            return string.Empty;
        }

        // Require at least 7 digits (excluding optional +).
        var digitsOnly = hasPlus ? result.Length - 1 : result.Length;
        return digitsOnly < 7 ? string.Empty : result.ToString();
    }

    // ============================================================================================
    /// <summary>
    /// Format a CNAM-style result such as "DOE,JANE" into "Jane Doe"
    /// If the value doesn't contain exactly one comma, the trimmed original is returned
    /// </summary>
    private static string? FormatCnamName(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return raw;
        }

        var trimmed = raw.Trim();

        // Only attempt to parse when there is exactly one comma
        var commaCount = 0;
        foreach (var ch in trimmed)
        {
            if (ch == ',')
            {
                commaCount++;
                if (commaCount > 1)
                {
                    break;
                }
            }
        }

        if (commaCount != 1)
        {
            return trimmed;
        }

        var parts = trimmed.Split(',', 2, StringSplitOptions.TrimEntries);
        if (parts.Length != 2)
        {
            return trimmed;
        }

        var last = ToTitleCaseWords(parts[0]);
        var first = ToTitleCaseWords(parts[1]);

        if (string.IsNullOrEmpty(first) || string.IsNullOrEmpty(last))
        {
            return trimmed;
        }

        return $"{first} {last}";
    }

    // ============================================================================================
    /// <summary>
    /// Converts a string to title case.
    /// </summary>
    /// <param name="value">The string to convert.</param>
    /// <returns>The title case string.</returns>
    private static string ToTitleCaseWords(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return value.Trim();
        }

        var words = value.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        for (var i = 0; i < words.Length; i++)
        {
            var word = words[i];
            if (word.Length == 1)
            {
                words[i] = char.ToUpperInvariant(word[0]).ToString();
            }
            else
            {
                words[i] = char.ToUpperInvariant(word[0]) + word.Substring(1).ToLowerInvariant();
            }
        }

        return string.Join(' ', words);
    }
}
