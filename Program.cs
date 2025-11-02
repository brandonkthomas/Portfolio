using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Routing;
using Portfolio.Services;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();
builder.Services.AddSingleton<IAssetManifest, AssetManifest>();

// Configure routing
builder.Services.Configure<RouteOptions>(options =>
{
    options.LowercaseUrls = true;   // for consistency
    options.LowercaseQueryStrings = true;
});

// Configure forwarded headers for working behind a proxy (Cloudflare)
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// Configure the application to use port 8081
builder.WebHost.UseUrls("http://*:8081");

var app = builder.Build();

// Configure HTTP request pipeline
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

// Use forwarded headers - place this early in the pipeline
app.UseForwardedHeaders();

// In prod, block direct access to original sources (/js/*) and source maps (*.map) via devtools/direct request
if (!app.Environment.IsDevelopment())
{
    app.Use(async (ctx, next) =>
    {
        var pathValue = ctx.Request.Path.Value ?? string.Empty;
        if (pathValue.EndsWith(".map", StringComparison.OrdinalIgnoreCase))
        {
            ctx.Response.StatusCode = 404;
            return;
        }
        if (pathValue.StartsWith("/js/", StringComparison.OrdinalIgnoreCase))
        {
            ctx.Response.StatusCode = 404;
            return;
        }
        await next();
    });
}

// app.UseHttpsRedirection();

// Static files with ETag-based caching for JS/CSS
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var n = ctx.File.Name;
        var path = ctx.Context.Request.Path.Value ?? string.Empty;
        if (n.EndsWith(".css"))
        {
            // Long-lived caching for CSS (uses asp-append-version)
            ctx.Context.Response.Headers["Cache-Control"] = "public, max-age=31536000, immutable";
        }
        else if (n.EndsWith(".js"))
        {
            // Hashed build assets under /dist get immutable caching; legacy /js gets revalidation
            if (path.Contains("/dist/", StringComparison.OrdinalIgnoreCase))
            {
                ctx.Context.Response.Headers["Cache-Control"] = "public, max-age=31536000, immutable";
            }
            else
            {
                ctx.Context.Response.Headers["Cache-Control"] = "public, max-age=0, must-revalidate";
            }
        }
        else if (n.EndsWith(".json"))
        {
            // Manifest and other JSON: allow revalidation
            ctx.Context.Response.Headers["Cache-Control"] = "public, max-age=0, must-revalidate";
        }
        else if (n.EndsWith(".jpg") || n.EndsWith(".jpeg") || n.EndsWith(".png") || n.EndsWith(".webp") || n.EndsWith(".gif"))
        {
            // Images can be immutable (filenames stable across deploy content) or use cache age
            ctx.Context.Response.Headers["Cache-Control"] = "public, max-age=31536000, immutable";
        }
    }
});

// Development-only: serve local photo store directly and generate manifest at runtime
if (app.Environment.IsDevelopment())
{
    var devPhotoPath = app.Configuration["DevPhotoPath"];
    if (Directory.Exists(devPhotoPath))
    {
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(devPhotoPath),
            RequestPath = "/assets/images/reel",
            OnPrepareResponse = ctx =>
            {
                ctx.Context.Response.Headers["Cache-Control"] = "public, max-age=0, must-revalidate";
            }
        });

        app.MapGet("/assets/images/reel/manifest.json", () =>
        {
            var exts = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp", ".gif" };
            var files = Directory.EnumerateFiles(devPhotoPath, "*.*", SearchOption.AllDirectories)
                                 .Where(p => exts.Contains(Path.GetExtension(p)))
                                 .Select(p => "/assets/images/reel/" + Path.GetRelativePath(devPhotoPath, p).Replace("\\", "/"))
                                 .OrderBy(p => p, StringComparer.OrdinalIgnoreCase)
                                 .ToList();
            // Natural sort using numeric segments
            files.Sort((a, b) => StringComparer.OrdinalIgnoreCase.Compare(Normalize(a), Normalize(b)));
            return Results.Json(new { images = files });

            static string Normalize(string s)
            {
                var result = new System.Text.StringBuilder(s.Length * 2);
                int i = 0;
                while (i < s.Length)
                {
                    if (char.IsDigit(s[i]))
                    {
                        int j = i;
                        while (j < s.Length && char.IsDigit(s[j])) j++;
                        var segment = s.Substring(i, j - i);
                        result.Append(segment.PadLeft(20, '0'));
                        i = j;
                    }
                    else
                    {
                        result.Append(s[i]);
                        i++;
                    }
                }
                return result.ToString();
            }
        });
    }
}

app.UseRouting();

// Cache control for HTML pages - set before response is sent
app.Use(async (ctx, next) =>
{
    ctx.Response.OnStarting(() =>
    {
        var ct = ctx.Response.ContentType ?? "";
        if (ct.Contains("text/html") && !ctx.Response.Headers.ContainsKey("Cache-Control"))
        {
            ctx.Response.Headers["Cache-Control"] = "no-cache, must-revalidate";
        }
        return Task.CompletedTask;
    });
    await next();
});
// app.UseAuthorization();

// Map root route to HomeController Index action
app.MapControllerRoute(
    name: "root",
    pattern: "/",
    defaults: new { controller = "Home", action = "Index" });

// Photos route to HomeController Photos action
app.MapControllerRoute(
    name: "photos",
    pattern: "/photos",
    defaults: new { controller = "Home", action = "Photos" });

// Projects route to HomeController Projects action
app.MapControllerRoute(
    name: "projects-spa",
    pattern: "/projects",
    defaults: new { controller = "Home", action = "Projects" });

// Project detail route to ProjectsController Detail action
app.MapControllerRoute(
    name: "project-detail",
    pattern: "/projects/{slug}",
    defaults: new { controller = "Projects", action = "Detail" });

app.MapControllerRoute(
    name: "error",
    pattern: "/error",
    defaults: new { controller = "Home", action = "Error" });

// Catchall route for unknown endpoints
app.MapControllerRoute(
    name: "catchall",
    pattern: "{*url}",
    defaults: new { controller = "Home", action = "RedirectToError" });

// Done!
app.Run();
