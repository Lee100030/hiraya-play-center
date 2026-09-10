using System.Security.Cryptography;
using System.Text;

namespace Hiraya.Shared.Security;

public static class InvitationTokens
{
    public static TimeSpan DefaultLifetime => TimeSpan.FromDays(7);

    public static string NewToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

    public static string Hash(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token.Trim()));
        return Convert.ToHexString(bytes);
    }
}
