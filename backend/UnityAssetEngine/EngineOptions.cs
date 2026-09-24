namespace Uniphrase.Engine;

sealed class EngineOptions
{
    public string? Input { get; init; }
    public string? Output { get; init; }
    public string? Translations { get; init; }
    public string? ClassData { get; init; }

    public static EngineOptions Parse(string[] args)
    {
        string? input = null;
        string? output = null;
        string? translations = null;
        string? classData = null;

        for (var i = 0; i < args.Length; i++)
        {
            var key = args[i];
            if (!key.StartsWith("--", StringComparison.Ordinal))
                throw new ArgumentException($"Unexpected argument '{key}'.");
            if (i + 1 >= args.Length || args[i + 1].StartsWith("--", StringComparison.Ordinal))
                throw new ArgumentException($"Missing value for {key}.");

            var value = args[++i];
            switch (key)
            {
                case "--input":
                    input = value;
                    break;
                case "--output":
                    output = value;
                    break;
                case "--translations":
                    translations = value;
                    break;
                case "--classdata":
                    classData = value;
                    break;
                default:
                    throw new ArgumentException($"Unknown option '{key}'.");
            }
        }

        return new EngineOptions
        {
            Input = input,
            Output = output,
            Translations = translations,
            ClassData = classData
        };
    }

    public static string Require(string? value, string flag)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException($"Missing {flag}.");
        return value;
    }
}
