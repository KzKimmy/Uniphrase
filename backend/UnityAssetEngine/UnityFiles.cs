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

    public static string? FindManagedFolder(string input)
    {
        var full = Path.GetFullPath(input);
        var directory = Directory.Exists(full) ? full : Path.GetDirectoryName(full);
        for (var depth = 0; depth < 6 && !string.IsNullOrEmpty(directory); depth++)
        {
            var beside = Path.Combine(directory, "Managed");
            if (ContainsAssemblies(beside))
                return beside;

            try
            {
                foreach (var dataDirectory in Directory.EnumerateDirectories(directory, "*_Data"))
                {
                    var managed = Path.Combine(dataDirectory, "Managed");
                    if (ContainsAssemblies(managed))
                        return managed;
                }
            }
            catch (IOException)
            {
                // A parent folder the process cannot list is not a game directory.
            }
            catch (UnauthorizedAccessException)
            {
                // See above.
            }

            directory = Path.GetDirectoryName(directory);
        }

        return null;
    }

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

    public static string BackupSibling(string source)
    {
        var directory = Path.GetDirectoryName(source) ?? "";
        var name = Path.GetFileName(source);
        var extension = Path.GetExtension(name);
        var backupName = extension.Length == 0
            ? name + "_BAK"
            : string.Concat(name.AsSpan(0, name.Length - extension.Length), "_BAK", extension);
        return Path.Combine(directory, backupName);
    }

    public static void ReplaceWithBackup(string source, string patchedTemp)
    {
        var backup = BackupSibling(source);
        if (string.Equals(Path.GetFullPath(backup), Path.GetFullPath(source), StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Refusing to replace the asset with itself.");
        if (!File.Exists(backup))
            File.Copy(source, backup, false);
        File.Move(patchedTemp, source, true);
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

    static bool ContainsAssemblies(string directory)
    {
        try
        {
            return Directory.Exists(directory) && Directory.EnumerateFiles(directory, "*.dll").Any();
        }
        catch (IOException)
        {
            return false;
        }
        catch (UnauthorizedAccessException)
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

        var fileName = Path.GetFileNameWithoutExtension(file);
        return fileName.EndsWith("_BAK", StringComparison.OrdinalIgnoreCase)
            || fileName.EndsWith("_trans", StringComparison.OrdinalIgnoreCase);
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
