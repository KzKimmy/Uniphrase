using System.Text.Encodings.Web;
using System.Text.Json;

namespace Uniphrase.Engine;

static class EngineIo
{
    static readonly JsonSerializerOptions Line = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    public static readonly JsonSerializerOptions FileOptions = new()
    {
        WriteIndented = true,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        PropertyNameCaseInsensitive = true
    };

    public static void Emit(object payload)
    {
        Console.Out.WriteLine(JsonSerializer.Serialize(payload, Line));
        Console.Out.Flush();
    }

    public static void Progress(int progress, string message) =>
        Emit(new { type = "progress", progress = Math.Clamp(progress, 0, 100), message });

    public static void Warning(string message) =>
        Emit(new { type = "warning", message });

    public static void Error(string message) =>
        Emit(new { type = "error", message });

    public static void Done(string message, int count, string output, int applied = 0) =>
        Emit(new { type = "done", progress = 100, message, count, applied, output });
}
