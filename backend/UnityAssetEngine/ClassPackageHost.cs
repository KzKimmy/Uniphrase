using AssetsTools.NET;
using AssetsTools.NET.Extra;

namespace Uniphrase.Engine;

sealed class ClassPackageHost : IDisposable
{
    readonly AssetsManager _manager = new();
    string? _databaseVersion;

    public ClassPackageHost(string? requestedPath)
    {
        var path = ResolvePath(requestedPath);
        ClassDataPath = path;
        if (path == null)
            return;

        try
        {
            _manager.LoadClassPackage(path);
            PackageLoaded = _manager.ClassPackage != null;
        }
        catch (Exception ex)
        {
            EngineIo.Warning($"Class database was not loaded: {ex.Message}");
        }
    }

    public AssetsManager Manager => _manager;
    public bool PackageLoaded { get; }
    public string? ClassDataPath { get; }

    public void EnsureDatabase(AssetsFile file)
    {
        if (file.Metadata.TypeTreeEnabled || !PackageLoaded)
            return;

        var version = file.Metadata.UnityVersion ?? "";
        if (version.Length == 0)
            throw new InvalidOperationException("Assets file has no type tree and no Unity version.");

        if (_databaseVersion == version && _manager.ClassDatabase != null)
            return;

        _manager.LoadClassDatabaseFromPackage(version);
        _databaseVersion = version;
    }

    public void ReleaseFiles()
    {
        try
        {
            _manager.UnloadAllAssetsFiles(true);
        }
        catch
        {
            // The bundle writer may already have closed the underlying stream.
        }

        try
        {
            _manager.UnloadAllBundleFiles();
        }
        catch
        {
            // See above.
        }
    }

    public static string? ResolvePath(string? requested)
    {
        if (!string.IsNullOrWhiteSpace(requested))
        {
            var full = Path.GetFullPath(requested);
            return File.Exists(full) ? full : throw new FileNotFoundException("Class database was not found.", full);
        }

        var beside = Path.Combine(AppContext.BaseDirectory, "classdata.tpk");
        if (File.Exists(beside))
            return beside;

        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        for (var i = 0; i < 6 && dir != null; i++, dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "backend", "UnityAssetEngine", "classdata.tpk");
            if (File.Exists(candidate))
                return candidate;
            candidate = Path.Combine(dir.FullName, "classdata.tpk");
            if (File.Exists(candidate))
                return candidate;
        }

        return null;
    }

    public void Dispose() => _manager.UnloadAll(true);
}
