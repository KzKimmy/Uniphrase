using System.Text;

namespace Uniphrase.Engine;

static class TextCodec
{
    public static bool IsMostlyText(byte[] bytes)
    {
        if (bytes.Length == 0)
            return false;
        if (HasBom(bytes) || LooksLikeUtf16Le(bytes))
            return true;

        var sample = Math.Min(bytes.Length, 8192);
        var bad = 0;
        for (var i = 0; i < sample; i++)
        {
            var value = bytes[i];
            if (value is 0 or 9 or 10 or 13)
                continue;
            if (value < 32)
                bad++;
        }

        return bad * 20 <= sample;
    }

    public static string Decode(byte[] bytes)
    {
        if (bytes.Length >= 2 && bytes[0] == 0xFF && bytes[1] == 0xFE)
            return Encoding.Unicode.GetString(bytes).TrimEnd('\0');
        if (bytes.Length >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF)
            return Encoding.BigEndianUnicode.GetString(bytes).TrimEnd('\0');
        if (bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF)
            return new UTF8Encoding(true).GetString(bytes).TrimEnd('\0');
        if (LooksLikeUtf16Le(bytes))
            return Encoding.Unicode.GetString(bytes).TrimEnd('\0');
        return Encoding.UTF8.GetString(bytes).TrimEnd('\0');
    }

    public static byte[] EncodeLike(byte[] original, string text)
    {
        Encoding encoding;
        if (original.Length >= 2 && original[0] == 0xFF && original[1] == 0xFE)
            encoding = Encoding.Unicode;
        else if (original.Length >= 2 && original[0] == 0xFE && original[1] == 0xFF)
            encoding = Encoding.BigEndianUnicode;
        else if (original.Length >= 3 && original[0] == 0xEF && original[1] == 0xBB && original[2] == 0xBF)
            encoding = new UTF8Encoding(true);
        else if (LooksLikeUtf16Le(original))
            encoding = Encoding.Unicode;
        else
            encoding = new UTF8Encoding(false);

        if (EndsWithNull(original, encoding))
            text += "\0";
        return encoding.GetBytes(text);
    }

    static bool HasBom(byte[] bytes) =>
        (bytes.Length >= 2 && bytes[0] == 0xFF && bytes[1] == 0xFE)
        || (bytes.Length >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF)
        || (bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF);

    static bool LooksLikeUtf16Le(byte[] bytes)
    {
        if (bytes.Length < 8 || bytes.Length % 2 != 0)
            return false;
        var pairs = Math.Min(bytes.Length, 200) / 2;
        var zeros = 0;
        for (var i = 0; i < pairs; i++)
        {
            if (bytes[i * 2 + 1] == 0 && bytes[i * 2] != 0)
                zeros++;
        }

        return zeros > pairs * 0.6;
    }

    static bool EndsWithNull(byte[] original, Encoding encoding)
    {
        if (original.Length == 0)
            return false;
        if (encoding.CodePage is 1200 or 1201)
            return original.Length >= 2 && original[^1] == 0 && original[^2] == 0;
        return original[^1] == 0;
    }
}
