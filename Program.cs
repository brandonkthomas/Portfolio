using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Routing;
using Portfolio.Services;
using Microsoft.Extensions.FileProviders;
using RealityCheck;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.DataProtection;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services
    .AddControllersWithViews()
    // Ensure controllers/views in app modules are discoverable
    .AddApplicationPart(typeof(NameTrace.Web.Controllers.NameTraceController).Assembly)
    .AddApplicationPart(typeof(RealityCheck.Web.Controllers.RealityCheckController).Assembly)
    .AddApplicationPart(typeof(ImageHexEditor.Web.Controllers.ImageHexEditorController).Assembly)
    .AddApplicationPart(typeof(WebAmp.Web.Controllers.IndexController).Assembly);
builder.Services.AddSingleton<IAssetManifest, AssetManifest>();
builder.Services.AddSingleton<AiDetector>();

// WebAmp: Spotify integration (OAuth + Web API proxy + Web Playback SDK token endpoint)
builder.Services.AddMemoryCache();
builder.Services.AddHttpClient();
builder.Services.Configure<WebAmp.Web.Spotify.SpotifyOptions>(builder.Configuration.GetSection("Spotify"));
builder.Services.AddScoped<WebAmp.Web.Spotify.SpotifyAuthService>();
builder.Services.AddScoped<WebAmp.Web.Spotify.SpotifyWebApiClient>();

// WebAmp: SoundCloud integration (app-level client credentials for public search/streaming)
builder.Services.Configure<WebAmp.Web.SoundCloud.SoundCloudOptions>(builder.Configuration.GetSection("SoundCloud"));
builder.Services.AddScoped<WebAmp.Web.SoundCloud.SoundCloudAuthService>();
builder.Services.AddScoped<WebAmp.Web.SoundCloud.SoundCloudApiClient>();
// WebAmp: SoundCloud user integration (Authorization Code + PKCE)
builder.Services.AddScoped<WebAmp.Web.SoundCloud.SoundCloudUserAuthService>();
builder.Services.AddScoped<WebAmp.Web.SoundCloud.SoundCloudUserApiClient>();

// Optional: persist DataProtection keys so auth cookies survive container recreation.
// Configure with env var: DataProtection__KeyRingPath=/data/protection-keys and mount that path in Docker.
var keyRingPath = builder.Configuration["DataProtection:KeyRingPath"];
if (!string.IsNullOrWhiteSpace(keyRingPath))
{
    builder.Services
        .AddDataProtection()
        .SetApplicationName("Portfolio")
        .PersistKeysToFileSystem(new DirectoryInfo(keyRingPath));
}

// Rate limiting (defense-in-depth for upload/compute endpoints)
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("realitycheck-upload", context =>
    {
        // Use the resolved remote IP (respects forwarded headers since we call app.UseForwardedHeaders()).
        var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(ip, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10,
            Window = TimeSpan.FromMinutes(1),
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit = 0
        });
    });
});

const string PhotoReelRequestPrefix = "/assets/images/reel/";

// Configure routing
builder.Services.Configure<RouteOptions>(options =>
{
    options.LowercaseUrls = true;   // for consistency
    options.LowercaseQueryStrings = true;
});

// Configure forwarded headers for working behind a proxy (Cloudflare)
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
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
    if (!string.IsNullOrWhiteSpace(devPhotoPath) && Directory.Exists(devPhotoPath))
    {
        var devPhotoRoot = devPhotoPath;

        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(devPhotoRoot),
            RequestPath = "/assets/images/reel",
            OnPrepareResponse = ctx =>
            {
                ctx.Context.Response.Headers["Cache-Control"] = "public, max-age=0, must-revalidate";
            }
        });

        app.MapGet("/assets/images/reel/manifest.json", () =>
        {
            var images = PhotoManifestGenerator.BuildEntries(devPhotoRoot, PhotoReelRequestPrefix);
            return Results.Json(new { images });
        });
    }
}

// Production (or when dev mapping didn't run): generate manifest from packaged wwwroot assets
if (!app.Environment.IsDevelopment())
{
    var webRoot = app.Environment.WebRootPath;
    var reelPath = Path.Combine(webRoot, "assets", "images", "reel");
    if (Directory.Exists(reelPath))
    {
        var packagedReelPath = reelPath;
        app.MapGet("/assets/images/reel/manifest.json", () =>
        {
            var images = PhotoManifestGenerator.BuildEntries(packagedReelPath, PhotoReelRequestPrefix);
            return Results.Json(new { images });
        });
    }
}

// Simple health check endpoint
app.MapGet("/api/health", () => Results.Ok());

app.UseRouting();
app.UseRateLimiter();

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

// Internal UI kit test page (not linked from navigation)
if (app.Environment.IsDevelopment())
{
    app.MapControllerRoute(
        name: "ui-kit",
        pattern: "/internal/ui",
        defaults: new { controller = "Home", action = "UiKit" });
}

// Project detail route to ProjectsController Detail action
app.MapControllerRoute(
    name: "project-detail",
    pattern: "/projects/{slug}",
    defaults: new { controller = "Projects", action = "Detail" });

// NameTrace landing page
app.MapControllerRoute(
    name: "nametrace",
    pattern: "/nametrace",
    defaults: new { controller = "NameTrace", action = "Index" });

// RealityCheck landing page
app.MapControllerRoute(
    name: "realitycheck",
    pattern: "/realitycheck",
    defaults: new { controller = "RealityCheck", action = "Index" });

// ImageHexEditor landing page
app.MapControllerRoute(
    name: "imagehexeditor",
    pattern: "/imagehexeditor",
    defaults: new { controller = "ImageHexEditor", action = "Index" });

// WebAmp landing page
app.MapControllerRoute(
    name: "webamp",
    pattern: "/webamp",
    defaults: new { controller = "WebAmp", action = "Index" });

// WebAmp SPA deep links (client-side router). Must come after the exact /webamp route.
app.MapControllerRoute(
    name: "webamp-spa",
    pattern: "/webamp/{*path}",
    defaults: new { controller = "WebAmp", action = "Index" });

// WebAmp: Spotify JSON API endpoints
app.MapControllerRoute(
    name: "webamp-spotify-api",
    pattern: "/api/webamp/spotify/{action}",
    defaults: new { controller = "SpotifyApi", action = "Status" });

// WebAmp: SoundCloud JSON API endpoints
app.MapControllerRoute(
    name: "webamp-soundcloud-api",
    pattern: "/api/webamp/soundcloud/{action}",
    defaults: new { controller = "SoundCloudApi", action = "Status" });

// WebAmp: SoundCloud user JSON API endpoints
app.MapControllerRoute(
    name: "webamp-soundcloud-user-api",
    pattern: "/api/webamp/soundclouduser/{action}",
    defaults: new { controller = "SoundCloudUserApi", action = "Status" });

// NameTrace API endpoint
app.MapControllerRoute(
    name: "nametrace-api",
    pattern: "/api/nametrace/lookup",
    defaults: new { controller = "NameTrace", action = "Lookup" });

// RealityCheck API endpoint
app.MapControllerRoute(
    name: "realitycheck-api",
    pattern: "/api/realitycheck/analyze",
    defaults: new { controller = "RealityCheck", action = "Analyze" });

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
