package tech.mpocket.testing;

import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.util.HashMap;
import java.util.Map;

/** Pending authorization metadata only. Privy's verifier never leaves WebView storage. */
final class PocketOAuth {
    static final String CALLBACK = "https://mpocket.tech/auth/android";
    static final long MAX_AGE_MS = 10 * 60 * 1000;
    final String authorizationUrl;
    final String state;
    final String returnUrl;
    final long createdAt;

    PocketOAuth(String authorizationUrl, String state, String returnUrl, long createdAt) {
        if (!validValue(state, 512) || authorizationUrl == null || authorizationUrl.length() > 8192
            || !PocketNavigation.isOAuthHost(authorizationUrl) || "oauth.telegram.org".equals(URI.create(authorizationUrl).getHost())
            || returnUrl == null || returnUrl.length() > 8192 || !PocketNavigation.isBundledRoute(returnUrl)) {
            throw new IllegalArgumentException("Invalid sign-in request.");
        }
        this.authorizationUrl = authorizationUrl;
        this.state = state;
        this.returnUrl = returnUrl;
        this.createdAt = createdAt;
    }

    static boolean isCallback(String value) {
        if (!PocketNavigation.isPocket(value)) return false;
        try { return "/auth/android".equals(new URI(value).getRawPath()); }
        catch (Exception ignored) { return false; }
    }

    boolean active(long now) { return now >= createdAt && now - createdAt <= MAX_AGE_MS; }
    boolean matchesAuthorization(String value, long now) { return active(now) && authorizationUrl.equals(value); }

    String accept(String callback, long now) {
        if (!active(now) || !isCallback(callback) || callback.length() > 16384) return null;
        try {
            URI uri = new URI(callback);
            if (uri.getRawFragment() != null || uri.getRawQuery() == null) return null;
            Map<String, String> parameters = new HashMap<>();
            for (String pair : uri.getRawQuery().split("&")) {
                String[] parts = pair.split("=", 2);
                String key = URLDecoder.decode(parts[0], "UTF-8");
                String value = parts.length == 2 ? URLDecoder.decode(parts[1], "UTF-8") : "";
                if (parameters.put(key, value) != null) return null;
            }
            String code = parameters.get("privy_oauth_code");
            if (!state.equals(parameters.get("privy_oauth_state")) || !"twitter".equals(parameters.get("privy_oauth_provider"))
                || !validValue(code, 4096)) return null;
            String[] fragment = returnUrl.split("#", 2);
            String separator = fragment[0].contains("?") ? "&" : "?";
            return fragment[0] + separator + "privy_oauth_code=" + encode(code)
                + "&privy_oauth_state=" + encode(state) + "&privy_oauth_provider=twitter"
                + (fragment.length == 2 ? "#" + fragment[1] : "");
        } catch (Exception ignored) { return null; }
    }

    private static boolean validValue(String value, int max) {
        if (value == null || value.isEmpty() || value.length() > max) return false;
        for (int i = 0; i < value.length(); i++) if (Character.isISOControl(value.charAt(i))) return false;
        return true;
    }
    private static String encode(String value) {
        try { return URLEncoder.encode(value, "UTF-8"); }
        catch (java.io.UnsupportedEncodingException impossible) { throw new IllegalStateException(impossible); }
    }
}
