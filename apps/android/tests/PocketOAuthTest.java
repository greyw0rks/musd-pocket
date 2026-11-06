package tech.mpocket.testing;

public final class PocketOAuthTest {
    private static void expect(boolean value, String message) { if (!value) throw new AssertionError(message); }
    public static void main(String[] args) {
        String authorization = "https://x.com/i/oauth2/authorize?fixture=1";
        String callback = PocketOAuth.CALLBACK + "?privy_oauth_code=fixture-code&privy_oauth_state=fixture-state&privy_oauth_provider=twitter";
        long start = 1000;
        for (String route : new String[] { "https://mpocket.tech/home?ref=friend", "https://mpocket.tech/pay/89YAGVPYD8ZXYE6FJWZUK652?ref=friend#checkout" }) {
            PocketOAuth pending = new PocketOAuth(authorization, "fixture-state", route, start);
            String accepted = pending.accept(callback, start + 100);
            expect(accepted != null && accepted.contains("ref=friend") && accepted.contains("privy_oauth_code=fixture-code"), "Return context and callback survive");
            expect(PocketNavigation.isBundledRoute(accepted), "Return uses bundled app");
            PocketOAuth restored = new PocketOAuth(pending.authorizationUrl, pending.state, pending.returnUrl, pending.createdAt);
            expect(accepted.equals(restored.accept(callback, start + 200)), "Cold process return uses persisted metadata");
            expect(pending.matchesAuthorization(authorization, start + 10), "Only prepared authorization opens browser");
            expect(!pending.matchesAuthorization(authorization + "&injected=1", start + 10), "Unprepared URL does not start browser auth");
            for (String bad : new String[] { callback.replace("fixture-state", "wrong-state"), callback.replace("twitter", "telegram"), callback.replace("https:", "http:"), callback.replace("mpocket.tech", "mpocket.tech.evil.test"), callback.replace("/auth/android", "/home"), callback + "&privy_oauth_state=fixture-state", callback + "#fragment", callback.replace("fixture-code", "") }) {
                expect(pending.accept(bad, start + 100) == null, "Untrusted callback rejected");
                expect(pending.accept(callback, start + 100) != null, "Rejected return does not consume pending auth");
            }
            expect(pending.accept(callback, start + PocketOAuth.MAX_AGE_MS + 1) == null, "Expired auth rejected");
            expect(pending.accept(callback, start - 1) == null, "Invalid clock range rejected");
        }
        for (String url : new String[] { "https://x.com.evil.test/authorize", "https://user@x.com/authorize", "https://x.com:444/authorize", "https://oauth.telegram.org/auth", "javascript:alert(1)" }) {
            try { new PocketOAuth(url, "fixture-state", PocketNavigation.HOME, start); throw new AssertionError("Bad authorization accepted"); }
            catch (IllegalArgumentException expected) { }
        }
        System.out.println("PASS: pending OAuth validation, Home/payment context, cold return, expiry and wrong-state rejection");
    }
}
