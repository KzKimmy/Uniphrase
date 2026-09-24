using System.Globalization;
using System.Text.Json;
using AssetsTools.NET;
using AssetsTools.NET.Extra;

namespace Uniphrase.Engine;

static class AssetExtractor
{
    public static int Run(EngineOptions options)
    {
        var input = EngineOptions.Require(options.Input, "--input");
        var output = EngineOptions.Require(options.Output, "--output");
        var root = UnityFiles.RootOf(input);
        var files = UnityFiles.Enumerate(input);
        if (files.Count == 0)
        {
            EngineIo.Error("No Unity assets or bundles were found.");
            return 1;
        }

        EngineIo.Progress(2, $"Found {files.Count} Unity file{(files.Count == 1 ? "" : "s")}.");
        var entries = new List<TranslationEntry>();
        var failures = 0;
        string? lastError = null;

        using var host = new ClassPackageHost(options.ClassData);
        if (!host.PackageLoaded)
            EngineIo.Warning("classdata.tpk was not loaded. Files without a type tree will be skipped.");

        for (var i = 0; i < files.Count; i++)
        {
            var file = files[i];
            var start = 5 + (int)Math.Round(i * 85.0 / files.Count);
            var name = Path.GetFileName(file);
            EngineIo.Progress(start, $"Reading {name}");
            try
            {
                var before = entries.Count;
                if (UnityFiles.IsBundle(file))
                    ExtractBundle(host, file, UnityFiles.Relative(root, file), entries);
                else
                    ExtractLoose(host, file, UnityFiles.Relative(root, file), entries);
                EngineIo.Progress(start, $"{name}: {entries.Count - before} strings");
            }
            catch (Exception ex)
            {
                failures++;
                lastError = ex.Message;
                EngineIo.Warning($"Skipped {name}: {ex.Message}");
            }
            finally
            {
                host.ReleaseFiles();
            }
        }

        if (entries.Count == 0 && failures > 0)
        {
            EngineIo.Error(lastError ?? "Extraction failed for every file.");
            return 1;
        }

        EngineIo.Progress(92, "Writing translation JSON…");
        var fullOutput = Path.GetFullPath(output);
        var directory = Path.GetDirectoryName(fullOutput);
        if (!string.IsNullOrEmpty(directory))
            Directory.CreateDirectory(directory);

        using (var stream = File.Create(fullOutput))
        {
            using var writer = new Utf8JsonWriter(stream, new JsonWriterOptions
            {
                Indented = true,
                Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
            });
            JsonSerializer.Serialize(writer, entries, EngineIo.FileOptions);
        }

        EngineIo.Done($"Extracted {entries.Count} strings from {files.Count} files.", entries.Count, fullOutput);
        return 0;
    }

    static void ExtractBundle(ClassPackageHost host, string path, string container, List<TranslationEntry> entries)
    {
        var bundle = host.Manager.LoadBundleFile(path, true);
        var names = bundle.file.GetAllFileNames();
        for (var i = 0; i < names.Count; i++)
        {
            if (!bundle.file.IsAssetsFile(i))
                continue;

            var assets = host.Manager.LoadAssetsFileFromBundle(bundle, i, false);
            var assetPath = UnityFiles.JoinAssetPath(container, names[i]);
            ExtractAssets(host, assets, assetPath, entries);
        }
    }

    static void ExtractLoose(ClassPackageHost host, string path, string container, List<TranslationEntry> entries)
    {
        var assets = host.Manager.LoadAssetsFile(path, false);
        ExtractAssets(host, assets, container, entries);
    }

    static void ExtractAssets(ClassPackageHost host, AssetsFileInstance assets, string assetPath, List<TranslationEntry> entries)
    {
        var file = assets.file;
        try
        {
            host.EnsureDatabase(file);
        }
        catch (Exception ex)
        {
            EngineIo.Warning($"{assetPath}: {ex.Message}");
            return;
        }

        AppendTextAssets(host, assets, assetPath, entries);
        AppendMonoBehaviours(host, assets, assetPath, entries);
    }

    static void AppendTextAssets(ClassPackageHost host, AssetsFileInstance assets, string assetPath, List<TranslationEntry> entries)
    {
        foreach (var info in assets.file.GetAssetsOfType(AssetClassID.TextAsset))
        {
            AssetTypeValueField root;
            try
            {
                root = host.Manager.GetBaseField(assets, info);
            }
            catch (Exception ex)
            {
                EngineIo.Warning($"TextAsset {info.PathId} in {assetPath}: {ex.Message}");
                continue;
            }

            if (!StringWalker.TryReadTextAsset(root, out var text))
                continue;

            entries.Add(new TranslationEntry
            {
                AssetPath = assetPath,
                PathId = info.PathId.ToString(CultureInfo.InvariantCulture),
                FieldPath = "m_Script",
                Type = "TextAsset",
                Name = StringWalker.ReadName(root) ?? $"TextAsset {info.PathId}",
                Original = text,
                Translation = ""
            });
        }
    }

    static void AppendMonoBehaviours(ClassPackageHost host, AssetsFileInstance assets, string assetPath, List<TranslationEntry> entries)
    {
        var infos = assets.file.GetAssetsOfType(AssetClassID.MonoBehaviour);
        var index = 0;
        foreach (var info in infos)
        {
            index++;
            if (index % 400 == 0)
                EngineIo.Emit(new { type = "log", message = $"{Path.GetFileName(assetPath)}: scanned {index}/{infos.Count} MonoBehaviours" });

            AssetTypeValueField root;
            try
            {
                root = host.Manager.GetBaseField(assets, info);
            }
            catch
            {
                continue;
            }

            var name = StringWalker.ReadName(root) ?? $"MonoBehaviour {info.PathId}";
            foreach (var hit in StringWalker.Collect(root))
            {
                if (!StringWalker.ShouldKeepMonoString(hit.FieldPath, hit.Value))
                    continue;

                entries.Add(new TranslationEntry
                {
                    AssetPath = assetPath,
                    PathId = info.PathId.ToString(CultureInfo.InvariantCulture),
                    FieldPath = hit.FieldPath,
                    Type = "MonoBehaviour",
                    Name = name,
                    Original = hit.Value,
                    Translation = ""
                });
            }
        }
    }
}
