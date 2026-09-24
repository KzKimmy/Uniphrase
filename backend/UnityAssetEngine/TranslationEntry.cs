using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Uniphrase.Engine;

sealed class TranslationEntry
{
    [JsonPropertyName("assetPath")]
    public string AssetPath { get; set; } = "";

    [JsonPropertyName("pathId")]
    [JsonConverter(typeof(JsonStringNumberConverter))]
    public string PathId { get; set; } = "";

    [JsonPropertyName("fieldPath")]
    public string FieldPath { get; set; } = "";

    [JsonPropertyName("type")]
    public string Type { get; set; } = "";

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("original")]
    public string Original { get; set; } = "";

    [JsonPropertyName("translation")]
    public string Translation { get; set; } = "";

    public bool HasReplacement =>
        Translation.Length > 0 && !string.Equals(Translation, Original, StringComparison.Ordinal);
}

/// <summary>
/// pathId is written as a string so values above 2^53 survive a JavaScript round-trip.
/// Numeric pathIds from older files are still accepted.
/// </summary>
sealed class JsonStringNumberConverter : JsonConverter<string>
{
    public override string? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        return reader.TokenType switch
        {
            JsonTokenType.String => reader.GetString() ?? "",
            JsonTokenType.Number => reader.TryGetInt64(out var number)
                ? number.ToString(CultureInfo.InvariantCulture)
                : reader.GetDecimal().ToString(CultureInfo.InvariantCulture),
            JsonTokenType.Null => "",
            _ => throw new JsonException("Expected a string or number.")
        };
    }

    public override void Write(Utf8JsonWriter writer, string value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value);
}
