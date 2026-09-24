using System.Text;
using AssetsTools.NET;

namespace Uniphrase.Engine;

static class UnityFiles
{
    static readonly HashSet<string> SkipExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".dll", ".exe", ".pdb", ".xml", ".json", ".txt", ".md", ".png", ".jpg", ".jpeg",
        ".gif", ".bmp", ".tga", ".dds", ".wav", ".ogg", ".mp3", ".bank", ".bnk", ".ress",
        ".resource", ".resS", ".zip", ".7z", ".tpk", ".cs", ".js", ".html", ".config"
    };

    static readonly HashSet<string> UnityExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".assets", ".bundle", ".unity3d", ".assetbundle", ".ab"
    };

    public static string RootOf(string input)
    {
        var full = Path.GetFullPath(input);
        if (File.Exists(full))
            return Path.GetDirectoryName(full) ?? full;
        if (Directory.Exists(full))
            return full;
        throw new FileNotFoundException("Input path does not exist.", input);
    }

    public static List<string> Enumerate(string input)
    {
        var full = Path.GetFullPath(input);
        if (File.Exists(full))
        {
            if (!IsCandidate(full))
                throw new InvalidOperationException($"'{Path.GetFileName(full)}' is not a Unity assets or bundle file.");
            return [full];
        }
        if (!Directory.Exists(full))
            throw new FileNotFoundException("Input path does not exist.", input);

        var files = new List<string>();
        foreach (var file in Directory.EnumerateFiles(full, "*", SearchOption.AllDirectories))
        {
            if (IsIgnored(full, file))
                continue;
            if (IsCandidate(file))
                files.Add(file);
        }

        files.Sort(StringComparer.OrdinalIgnoreCase);
        return files;
    }

    public static string Relative(string root, string fullPath) =>
        Path.GetRelativePath(root, fullPath).Replace('\\', '/');

    public static string ResolveInside(string root, string relative)
    {
        var combined = Path.GetFullPath(Path.Combine(root, relative.Replace('/', Path.DirectorySeparatorChar)));
        var rootFull = Path.GetFullPath(root)
            .TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!combined.StartsWith(rootFull, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(combined.TrimEnd(Path.DirectorySeparatorChar), rootFull.TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"Asset path '{relative}' escapes the input folder.");
        }

        return combined;
    }

    public static bool IsBundle(string path)
    {
        try
        {
            using var stream = File.OpenRead(path);
            if (stream.Length < 8)
                return false;
            Span<byte> buffer = stackalloc byte[8];
            var read = stream.Read(buffer);
            if (read < 7)
                return false;
            var signature = Encoding.ASCII.GetString(buffer[..7]);
            return signature is "UnityFS" or "UnityWe" or "UnityRa";
        }
        catch
        {
            return false;
        }
    }

    static bool IsCandidate(string path)
    {
        var extension = Path.GetExtension(path);
        if (SkipExtensions.Contains(extension))
            return false;

        var info = new FileInfo(path);
        if (info.Length < 64)
            return false;

        if (UnityExtensions.Contains(extension) || IsBundle(path))
            return true;

        var name = Path.GetFileName(path);
        if (name.Contains(".assets", StringComparison.OrdinalIgnoreCase)
            || name.StartsWith("CAB-", StringComparison.OrdinalIgnoreCase)
            || name.StartsWith("sharedassets", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        try
        {
            return AssetsFile.IsAssetsFile(path);
        }
        catch
        {
            return false;
        }
    }

    static bool IsIgnored(string root, string file)
    {
        var relative = Path.GetRelativePath(root, file);
        var parts = relative.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        foreach (var part in parts)
        {
            if (part.Equals("node_modules", StringComparison.OrdinalIgnoreCase)
                || part.Equals("Managed", StringComparison.OrdinalIgnoreCase)
                || part.Equals(".git", StringComparison.OrdinalIgnoreCase)
                || part.Equals("obj", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    public static (string Container, string? InternalPath) SplitAssetPath(string assetPath)
    {
        var index = assetPath.IndexOf("::", StringComparison.Ordinal);
        if (index < 0)
            return (assetPath, null);
        return (assetPath[..index], assetPath[(index + 2)..]);
    }

    public static string JoinAssetPath(string container, string? internalPath)
    {
        var normalized = container.Replace('\\', '/');
        if (string.IsNullOrEmpty(internalPath))
            return normalized;
        return normalized + "::" + internalPath.Replace('\\', '/');
    }
}
