using Microsoft.AspNetCore.Mvc;

namespace Portfolio.Controllers;

public class ProjectsController : Controller
{
    [HttpGet("/projects/{slug}")]
    public IActionResult Detail(string slug)
    {
        ViewData["Title"] = slug?.Replace('-', ' ') ?? "Project";
        return View();
    }
}
