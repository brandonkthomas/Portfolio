using Microsoft.AspNetCore.HttpOverrides;
using WebOptimizer;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();

// Add WebOptimizer services
builder.Services.AddWebOptimizer(pipeline =>
{
    // Only minify in production
    if (!builder.Environment.IsDevelopment())
    {
        // Minify all CSS files
        pipeline.MinifyCssFiles();
        
        // Minify all JavaScript files
        pipeline.MinifyJsFiles();
    }
});

// Configure forwarded headers for working behind a proxy like Cloudflare
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// Configure the application to use port 8081
builder.WebHost.UseUrls("http://*:8081");

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
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

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
