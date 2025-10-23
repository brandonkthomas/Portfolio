using System.Text.Json;

namespace Portfolio.Services
{
    public interface IAssetManifest
    {
        string GetAssetPath(string assetFileName);
    }

    public class AssetManifest : IAssetManifest
    {
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<AssetManifest> _logger;
        private readonly object _lock = new object();
        private Dictionary<string, string> _manifest = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        private bool _loaded;

        public AssetManifest(IWebHostEnvironment env, ILogger<AssetManifest> logger)
        {
            _env = env;
            _logger = logger;
        }

        public string GetAssetPath(string assetFileName)
        {
            try
            {
                EnsureLoaded();

                if (_manifest.TryGetValue(assetFileName, out var mapped))
                {
                    return mapped;
                }

                // Fallbacks if manifest key is missing (should not happen in Production)
                // Prefer original dev path to avoid 404s
                if (assetFileName.EndsWith(".js", StringComparison.OrdinalIgnoreCase))
                {
                    return "/js/" + assetFileName;
                }
                return "/" + assetFileName.TrimStart('/');
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resolving asset path for {Asset}", assetFileName);
                // Safe fallback to unbundled asset
                return "/js/" + assetFileName;
            }
        }

        private void EnsureLoaded()
        {
            if (_loaded)
            {
                return;
            }

            lock (_lock)
            {
                if (_loaded)
                {
                    return;
                }

                try
                {
                    var manifestPath = Path.Combine(_env.WebRootPath ?? "wwwroot", "dist", "manifest.json");
                    if (File.Exists(manifestPath))
                    {
                        var json = File.ReadAllText(manifestPath);
                        var data = JsonSerializer.Deserialize<Dictionary<string, string>>(json);
                        if (data != null)
                        {
                            _manifest = new Dictionary<string, string>(data, StringComparer.OrdinalIgnoreCase);
                        }
                        _loaded = true;
                    }
                    else
                    {
                        _logger.LogWarning("Asset manifest not found at {Path}", manifestPath);
                        _loaded = true; // Avoid repeated attempts
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to load asset manifest");
                    _loaded = true;
                }
            }
        }
    }
}


