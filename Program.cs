using Microsoft.AspNetCore.HttpOverrides;
using WebOptimizer;
using NUglify;
using Microsoft.AspNetCore.Routing;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();

// Configure routing
builder.Services.Configure<RouteOptions>(options =>
{
    options.LowercaseUrls = true;   // for consistency
    options.LowercaseQueryStrings = true;
});

// Add WebOptimizer services
builder.Services.AddWebOptimizer(pipeline =>
{
    // Only minify in production
    if (!builder.Environment.IsDevelopment())
    {
        // Minify all CSS files
        pipeline.MinifyCssFiles();
        
        // Minify all JavaScript files with name mangling enabled
        pipeline.MinifyJsFiles(new NUglify.JavaScript.CodeSettings 
        {
            MinifyCode = true,
            LocalRenaming = NUglify.JavaScript.LocalRenaming.CrunchAll, // Enable variable/function name mangling
            PreserveFunctionNames = false // Allow function names to be mangled
        });
    }
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

// Add WebOptimizer middleware
app.UseWebOptimizer();

// app.UseHttpsRedirection();

// Static files with ETag-based caching for JS/CSS
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var n = ctx.File.Name;
        if (n.EndsWith(".js") || n.EndsWith(".css"))
        {
            // Use ETag validation with 7-day cache - works perfectly with ES6 modules
            // Cloudflare will cache based on ETag, and browsers revalidate efficiently
            ctx.Context.Response.Headers["Cache-Control"] = "public, max-age=604800, must-revalidate";
        }
    }
});

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
