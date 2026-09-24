using System.Text;

namespace Uniphrase.Engine;

/// <summary>
/// Unity asset extract / repack CLI. Every stdout line is a single JSON object.
/// </summary>
public static class Program
{
    public static int Main(string[] args)
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        try
        {
            if (args.Length == 0 || args[0] is "-h" or "--help" or "help")
            {
                EngineIo.Emit(new
                {
                    type = "help",
                    message = "unity-core-engine extract --input <file-or-folder> --output <json> [--classdata <tpk>]\n" +
                              "unity-core-engine repack --input <file-or-folder> --translations <json> [--classdata <tpk>]\n" +
                              "unity-core-engine version"
                });
                return args.Length == 0 ? 1 : 0;
            }

            var command = args[0].Trim().ToLowerInvariant();
            var options = EngineOptions.Parse(args.Length > 1 ? args[1..] : []);
            return command switch
            {
                "extract" => AssetExtractor.Run(options),
                "repack" => AssetRepacker.Run(options),
                "version" => PrintVersion(options),
                _ => Fail($"Unknown command '{command}'.")
            };
        }
        catch (Exception ex)
        {
            EngineIo.Error(ex.Message);
            return 1;
        }
    }

    static int PrintVersion(EngineOptions options)
    {
        var classData = ClassPackageHost.ResolvePath(options.ClassData);
        var loaded = false;
        string? error = null;
        if (classData != null)
        {
            try
            {
                using var host = new ClassPackageHost(classData);
                loaded = host.PackageLoaded;
            }
            catch (Exception ex)
            {
                error = ex.Message;
            }
        }

        EngineIo.Emit(new
        {
            type = "version",
            version = "1.0.0",
            assetsTools = "3.0.5",
            classData = classData ?? "",
            classDataLoaded = loaded,
            message = error ?? (loaded ? "Class database ready." : "Class database not loaded. Bundles with type trees still work.")
        });
        return 0;
    }

    static int Fail(string message)
    {
        EngineIo.Error(message);
        return 1;
    }
}
