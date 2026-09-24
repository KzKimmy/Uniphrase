using System.Globalization;
using System.Text.Json;
using AssetsTools.NET;
using AssetsTools.NET.Extra;

namespace Uniphrase.Engine;

static class AssetRepacker
{
    public static int Run(EngineOptions options)
    {
        var input = EngineOptions.Require(options.Input, "--input");
        var translationsPath = EngineOptions.Require(options.Translations, "--translations");
        var output = EngineOptions.Require(options.Output, "--output");

        if (!File.Exists(translationsPath))
            throw new FileNotFoundException("Translation file was not found.", translationsPath);

        var root = UnityFiles.RootOf(input);
        var outputFull = Path.GetFullPath(output);
        if (string.Equals(Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar), outputFull.TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Output folder must be different from the original assets folder.");

        List<TranslationEntry> entries;
        using (var stream = File.OpenRead(translationsPath))
        {
            entries = JsonSerializer.Deserialize<List<TranslationEntry>>(stream, EngineIo.FileOptions)
                ?? throw new InvalidOperationException("Translation file is empty.");
        }

        var pending = entries.Where(entry => entry.HasReplacement).ToList();
        if (pending.Count == 0)
        {
            Directory.CreateDirectory(outputFull);
            EngineIo.Done("No translated strings to write. Empty translations keep the original text.", 0, outputFull);
            return 0;
        }

        var groups = pending.GroupBy(entry => UnityFiles.SplitAssetPath(entry.AssetPath).Container, StringComparer.OrdinalIgnoreCase)
            .ToList();

        EngineIo.Progress(4, $"Applying {pending.Count} translations across {groups.Count} files.");
        using var host = new ClassPackageHost(options.ClassData);
        var applied = 0;
        var written = 0;
        var failures = 0;

        for (var i = 0; i < groups.Count; i++)
        {
            var group = groups[i];
            var start = 8 + (int)Math.Round(i * 80.0 / groups.Count);
            var container = group.Key;
            EngineIo.Progress(start, $"Patching {container}");
            try
            {
                var source = UnityFiles.ResolveInside(root, container);
                if (!File.Exists(source))
                    throw new FileNotFoundException("Original asset was not found.", source);

                var destination = Path.Combine(outputFull, container.Replace('/', Path.DirectorySeparatorChar));
                var destinationDir = Path.GetDirectoryName(destination);
                if (!string.IsNullOrEmpty(destinationDir))
                    Directory.CreateDirectory(destinationDir);

                var count = UnityFiles.IsBundle(source)
                    ? PatchBundle(host, source, destination, group)
                    : PatchLoose(host, source, destination, group);
                applied += count;
                if (count > 0)
                    written++;
            }
            catch (Exception ex)
            {
                failures++;
                EngineIo.Warning($"Skipped {container}: {ex.Message}");
            }
            finally
            {
                host.ReleaseFiles();
            }
        }

        if (written == 0)
        {
            EngineIo.Error(failures > 0
                ? "Repack failed for every file."
                : "Translations did not match any asset fields.");
            return 1;
        }

        EngineIo.Done($"Patched {applied} strings into {written} files.", applied, outputFull, applied);
        return 0;
    }

    static int PatchBundle(ClassPackageHost host, string source, string destination, IEnumerable<TranslationEntry> entries)
    {
        var bundleInst = host.Manager.LoadBundleFile(source, true);
        var bundle = bundleInst.file;
        var byInternal = entries.GroupBy(entry => UnityFiles.SplitAssetPath(entry.AssetPath).InternalPath ?? "", StringComparer.OrdinalIgnoreCase);
        var changedFiles = 0;
        var applied = 0;

        foreach (var group in byInternal)
        {
            var index = FindFile(bundle, group.Key);
            if (index < 0)
                throw new InvalidOperationException($"Bundle does not contain '{group.Key}'.");
            if (!bundle.IsAssetsFile(index))
                throw new InvalidOperationException($"'{group.Key}' is not a serialized assets file.");

            var assets = host.Manager.LoadAssetsFileFromBundle(bundleInst, index, false);
            var count = PatchAssets(host, assets, group);
            if (count == 0)
                continue;

            bundle.BlockAndDirInfo.DirectoryInfos[index].SetNewData(assets.file);
            applied += count;
            changedFiles++;
        }

        if (changedFiles == 0)
            return 0;

        var compression = bundleInst.originalCompression;
        EngineIo.Progress(90, compression == AssetBundleCompressionType.None
            ? "Writing uncompressed bundle…"
            : $"Writing bundle ({compression})…");
        WriteBundle(bundle, destination, compression);
        return applied;
    }

    static int PatchLoose(ClassPackageHost host, string source, string destination, IEnumerable<TranslationEntry> entries)
    {
        var assets = host.Manager.LoadAssetsFile(source, false);
        var applied = PatchAssets(host, assets, entries);
        if (applied == 0)
            return 0;

        using var writer = new AssetsFileWriter(destination);
        assets.file.Write(writer);
        return applied;
    }

    static int PatchAssets(ClassPackageHost host, AssetsFileInstance assets, IEnumerable<TranslationEntry> entries)
    {
        host.EnsureDatabase(assets.file);
        var touched = new Dictionary<long, (AssetFileInfo Info, AssetTypeValueField Root)>();
        var dirty = new HashSet<long>();
        var applied = 0;

        foreach (var entry in entries)
        {
            if (!long.TryParse(entry.PathId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var pathId))
            {
                EngineIo.Warning($"Skipped invalid pathId '{entry.PathId}'.");
                continue;
            }

            var info = assets.file.GetAssetInfo(pathId);
            if (info == null)
            {
                EngineIo.Warning($"PathID {entry.PathId} was not found.");
                continue;
            }

            if (!touched.TryGetValue(pathId, out var pair))
            {
                pair = (info, host.Manager.GetBaseField(assets, info));
                touched[pathId] = pair;
            }

            var fieldPath = entry.FieldPath;
            if (fieldPath.Length == 0 && string.Equals(entry.Type, "TextAsset", StringComparison.OrdinalIgnoreCase))
                fieldPath = "m_Script";

            var field = StringWalker.Resolve(pair.Root, fieldPath);
            if (field == null)
            {
                EngineIo.Warning($"Field '{fieldPath}' was not found on pathId {entry.PathId}.");
                continue;
            }

            try
            {
                StringWalker.WriteValue(field, entry.Translation);
            }
            catch (Exception ex)
            {
                EngineIo.Warning($"PathID {entry.PathId} field '{fieldPath}': {ex.Message}");
                continue;
            }

            dirty.Add(pathId);
            applied++;
        }

        foreach (var pathId in dirty)
            touched[pathId].Info.SetNewData(touched[pathId].Root);

        return applied;
    }

    static int FindFile(AssetBundleFile bundle, string internalName)
    {
        if (internalName.Length == 0)
        {
            var names = bundle.GetAllFileNames();
            for (var i = 0; i < names.Count; i++)
            {
                if (bundle.IsAssetsFile(i))
                    return i;
            }

            return names.Count == 1 ? 0 : -1;
        }

        var files = bundle.GetAllFileNames();
        for (var i = 0; i < files.Count; i++)
        {
            if (string.Equals(files[i].Replace('\\', '/'), internalName.Replace('\\', '/'), StringComparison.OrdinalIgnoreCase))
                return i;
        }

        return -1;
    }

    static void WriteBundle(AssetBundleFile bundle, string destination, AssetBundleCompressionType compression)
    {
        var temp = Path.Combine(Path.GetTempPath(), "uniphrase-" + Guid.NewGuid().ToString("N") + ".bundle");
        var partial = destination + ".partial";
        try
        {
            using (var writer = new AssetsFileWriter(temp))
                bundle.Write(writer);
            bundle.Close();

            if (compression == AssetBundleCompressionType.None)
            {
                if (File.Exists(destination))
                    File.Delete(destination);
                File.Move(temp, destination);
                return;
            }

            var packed = new AssetBundleFile();
            packed.Read(new AssetsFileReader(temp));
            using (var writer = new AssetsFileWriter(partial))
                packed.Pack(writer, compression);
            packed.Close();

            if (File.Exists(destination))
                File.Delete(destination);
            File.Move(partial, destination);
        }
        finally
        {
            if (File.Exists(temp))
                File.Delete(temp);
            if (File.Exists(partial))
                File.Delete(partial);
        }
    }
}
