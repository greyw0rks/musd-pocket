package tech.mpocket.testing;

public final class PocketNavigationTest {
    private static void expect(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }

    public static void main(String[] args) {
        String callback = "https://mpocket.tech/home?privy_oauth_code=test-code&privy_oauth_state=test-state&privy_oauth_provider=twitter";
        expect(PocketNavigation.intentUrl(callback).equals(callback), "Warm/cold callback must retain all OAuth parameters");
        expect(PocketNavigation.isBundledRoute(callback), "Callback must load the APK assets");
        String payment = callback.replace("/home?", "/pay/89YAGVPYD8ZXYE6FJWZUK652?");
        expect(PocketNavigation.intentUrl(payment).equals(payment), "Payment checkout must survive authentication");
        expect(PocketNavigation.isOAuthHost("https://x.com/i/oauth2/authorize?state=test-state"), "Mobile redirect must stay in the app");
        expect(PocketNavigation.isOAuthHost("https://twitter.com/i/flow/login"), "Twitter login redirects must stay in the app");
        expect(PocketNavigation.isOAuthHost("https://auth.privy.io/api/v1/oauth/callback"), "Provider callback must stay in the app");
        for (String url : new String[] { "https://x.com.evil.test/i/oauth2/authorize", "http://x.com/i/oauth2/authorize", "https://x.com:444/i/oauth2/authorize", "https://user@x.com/i/oauth2/authorize", "https://evil.test/?next=https://x.com", "javascript:alert(1)", "https://mpocket.tech.evil.test/home", "https://mpocket.tech:444/home", "https://user@mpocket.tech/home", "https://example.com/", "not a uri" }) {
            expect(!PocketNavigation.isOAuthHost(url), "Untrusted URL cannot be an OAuth destination: " + url);
            expect(PocketNavigation.intentUrl(url).equals(PocketNavigation.HOME), "Untrusted intent cannot inject a callback: " + url);
        }
        expect(PocketNavigation.intentUrl(null).equals(PocketNavigation.HOME), "Launcher without data opens home");
        System.out.println("PASS: OAuth navigation, callback query preservation, payment return and untrusted URL rejection");
    }
}
