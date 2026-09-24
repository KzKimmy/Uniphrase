using System.Globalization;
using System.Text.RegularExpressions;
using AssetsTools.NET;

namespace Uniphrase.Engine;

readonly record struct StringHit(string FieldPath, string Value);

static class StringWalker
{
    static readonly Regex GuidPattern = new("^[0-9a-fA-F]{32}$", RegexOptions.Compiled);
    static readonly Regex HexPattern = new("^[0-9a-fA-F]{16,}$", RegexOptions.Compiled);

    public static List<StringHit> Collect(AssetTypeValueField root)
    {
        var hits = new List<StringHit>();
        Walk(root, "", 0, hits);
        return hits;
    }

    public static AssetTypeValueField? Resolve(AssetTypeValueField root, string fieldPath)
    {
        if (string.IsNullOrWhiteSpace(fieldPath))
            return null;

        var current = root;
        foreach (var part in fieldPath.Split('/'))
        {
            if (current.Children == null || current.Children.Count == 0)
                return null;

            var hash = part.LastIndexOf('#');
            string name;
            int? occurrence = null;
            if (hash > 0 && int.TryParse(part[(hash + 1)..], NumberStyles.Integer, CultureInfo.InvariantCulture, out var index))
            {
                name = part[..hash];
                occurrence = index;
            }
            else
            {
                name = part;
            }

            AssetTypeValueField? match = null;
            var seen = 0;
            foreach (var child in current.Children)
            {
                if (child == null || child.IsDummy)
                    continue;
                var childName = NameOf(child);
                if (!string.Equals(childName, name, StringComparison.Ordinal))
                    continue;
                if (occurrence == null || seen == occurrence)
                {
                    match = child;
                    break;
                }

                seen++;
            }

            if (match == null)
                return null;
            current = match;
        }

        return current.IsDummy ? null : current;
    }

    public static bool ShouldKeepMonoString(string fieldPath, string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return false;

        var leaf = fieldPath.Split('/').LastOrDefault() ?? "";
        var hash = leaf.LastIndexOf('#');
        if (hash >= 0)
            leaf = leaf[..hash];

        if (leaf is "m_Name" or "m_EditorClassIdentifier" or "m_Script" or "m_CorrespondingSourceObject" or "m_TagString")
            return false;

        var trimmed = value.Trim();
        if (trimmed.Length is < 2 or > 100_000)
            return false;
        if (!trimmed.Any(char.IsLetter))
            return false;
        if (GuidPattern.IsMatch(trimmed) || HexPattern.IsMatch(trimmed))
            return false;
        if (trimmed.StartsWith("UnityEngine.", StringComparison.Ordinal)
            || trimmed.StartsWith("UnityEditor.", StringComparison.Ordinal)
            || trimmed.StartsWith("Assembly-CSharp", StringComparison.Ordinal))
            return false;
        if (LooksLikeAssetPath(trimmed))
            return false;
        if (trimmed.Length > 180 && !trimmed.Any(char.IsWhiteSpace))
            return false;
        return true;
    }

    public static string? ReadName(AssetTypeValueField root)
    {
        var name = root.Get("m_Name");
        if (name == null || name.IsDummy || name.Value?.ValueType != AssetValueType.String)
            return null;
        var text = name.AsString;
        return string.IsNullOrWhiteSpace(text) ? null : text;
    }

    public static bool TryReadTextAsset(AssetTypeValueField root, out string text)
    {
        text = "";
        var script = root.Get("m_Script");
        if (script == null || script.IsDummy || script.Value == null)
            return false;

        if (script.Value.ValueType == AssetValueType.String)
        {
            text = script.AsString ?? "";
            return !string.IsNullOrWhiteSpace(text);
        }

        if (script.Value.ValueType == AssetValueType.ByteArray)
        {
            var bytes = script.AsByteArray ?? [];
            if (!TextCodec.IsMostlyText(bytes))
                return false;
            text = TextCodec.Decode(bytes);
            return !string.IsNullOrWhiteSpace(text);
        }

        return false;
    }

    public static void WriteValue(AssetTypeValueField field, string translation)
    {
        var valueType = field.Value?.ValueType ?? AssetValueType.None;
        if (valueType == AssetValueType.ByteArray)
        {
            field.AsByteArray = TextCodec.EncodeLike(field.AsByteArray ?? [], translation);
            return;
        }

        if (valueType != AssetValueType.String)
            throw new InvalidOperationException($"Field '{field.FieldName}' is {valueType}, not a string.");

        field.AsString = translation;
    }

    static void Walk(AssetTypeValueField field, string path, int depth, List<StringHit> hits)
    {
        if (field == null || field.IsDummy || depth > 32)
            return;

        var valueType = field.Value?.ValueType ?? AssetValueType.None;
        if (valueType == AssetValueType.String)
        {
            if (path.Length > 0)
                hits.Add(new StringHit(path, field.AsString ?? ""));
            return;
        }

        if (valueType == AssetValueType.ByteArray)
            return;
        if (valueType == AssetValueType.None && (field.Children == null || field.Children.Count == 0))
            return;

        var children = field.Children;
        if (children == null || children.Count == 0)
            return;

        var counts = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var child in children)
        {
            if (child == null || child.IsDummy)
                continue;
            var name = NameOf(child);
            counts[name] = counts.GetValueOrDefault(name) + 1;
        }

        var seen = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var child in children)
        {
            if (child == null || child.IsDummy)
                continue;
            var name = NameOf(child);
            var occurrence = seen.GetValueOrDefault(name);
            seen[name] = occurrence + 1;
            var segment = counts[name] > 1 ? $"{name}#{occurrence}" : name;
            var childPath = path.Length == 0 ? segment : path + "/" + segment;
            Walk(child, childPath, depth + 1, hits);
        }
    }

    static string NameOf(AssetTypeValueField field) =>
        string.IsNullOrEmpty(field.FieldName) ? "data" : field.FieldName;

    static bool LooksLikeAssetPath(string value)
    {
        if (value.Contains(' ') || value.Contains('\n'))
            return false;
        if (!value.Contains('/') && !value.Contains('\\'))
            return false;
        var extension = Path.GetExtension(value.Replace('\\', '/'));
        return extension.Length is >= 2 and <= 8;
    }
}
