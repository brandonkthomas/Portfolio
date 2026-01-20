using Microsoft.AspNetCore.Mvc;
using System.Globalization;

namespace Portfolio.Controllers;

public class ProjectsController : Controller
{
    [HttpGet("/projects/{slug}")]
    public IActionResult Detail(string slug)
    {
        var raw = slug?.Replace('-', ' ').Trim() ?? "Project";
        var titled = CultureInfo.InvariantCulture.TextInfo.ToTitleCase(raw.ToLowerInvariant());
        ViewData["Title"] = titled;
        return View();
    }
}
