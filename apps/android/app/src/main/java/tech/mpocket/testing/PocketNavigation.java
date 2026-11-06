package tech.mpocket.testing;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/** URL decisions shared by Android navigation and the JVM regression checks. */
final class PocketNavigation {
    static final String HOME = "https://mpocket.tech/home";

    private static URI parse(String value) {
        try { return new URI(value); }
        catch (URISyntaxException | NullPointerException error) { return null; }
    }

    private static boolean https(URI uri) {
        return uri != null && "https".equalsIgnoreCase(uri.getScheme())
            && uri.getRawUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    static boolean isPocket(String value) {
        URI uri = parse(value);
        return https(uri) && "mpocket.tech".equalsIgnoreCase(uri.getHost());
    }

    static boolean isBundledRoute(String value) {
        URI uri = parse(value);
        if (!isPocket(value)) return false;
        String path = uri.getPath();
        return "/home".equals(path) || (path != null && path.startsWith("/pay/"));
    }

    static boolean isOAuthHost(String value) {
        URI uri = parse(value);
        if (!https(uri) || uri.getHost() == null) return false;
        // Privy redirects the mobile window itself. Keep its identity-provider
        // journey in the same WebView so the PKCE verifier and session survive.
        switch (uri.getHost().toLowerCase(Locale.ROOT)) {
            case "x.com":
            case "twitter.com":
            case "api.x.com":
            case "api.twitter.com":
            case "auth.privy.io":
            case "oauth.telegram.org":
                return true;
            default:
                return false;
        }
    }

    static String intentUrl(String value) {
        if (isBundledRoute(value)) return value; // Preserve Privy's code/state/provider query.
        return HOME;
    }
}
