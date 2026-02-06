using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Portfolio.Models;

namespace Portfolio.Controllers;

// HomeController handles the root route and redirects to the index view
public class HomeController : Controller
{
    private readonly ILogger<HomeController> _logger; 

    public HomeController(ILogger<HomeController> logger)
    {
        _logger = logger;
    }

    public IActionResult Index()
    {
        ViewData["ForceSiteTitle"] = true;
        return View();
    }

    /// <summary>
    /// Internal UI kit test layout (not linked from navigation)
    /// </summary>
    public IActionResult UiKit()
    {
        ViewData["Title"] = "UI Kit";
        ViewData["CanPinchToZoom"] = true;
        return View();
    }

    public IActionResult Photos()
    {
        ViewData["Title"] = "Photos";
        ViewData["ForceSiteTitle"] = true;
        return View("Index");
    }

    public IActionResult Projects()
    {
        ViewData["Title"] = "Projects";
        ViewData["ForceSiteTitle"] = true;
        return View("Index");
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
    
    public IActionResult RedirectToError()
    {
        return RedirectToAction(nameof(error));
    }

    [Route("{*url}", Order = int.MaxValue)]
    public IActionResult CatchAll()
    {
        return RedirectToAction("Index");
    }
}
