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
    app.UseExceptionHandler("/home/error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

// Use forwarded headers - place this early in the pipeline
app.UseForwardedHeaders();

// Add WebOptimizer middleware
app.UseWebOptimizer();

// app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
// app.UseAuthorization();

// Map root route to HomeController Index action
app.MapControllerRoute(
    name: "root",
    pattern: "/",
    defaults: new { controller = "Home", action = "Index" });

app.MapControllerRoute(
    name: "error",
    pattern: "home/error",
    defaults: new { controller = "Home", action = "Error" });

// Catchall route for unknown endpoints
app.MapControllerRoute(
    name: "catchall",
    pattern: "{*url}",
    defaults: new { controller = "Home", action = "CatchAll" });

// Done!
app.Run();
