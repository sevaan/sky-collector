package app.skycollector;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.review.ReviewInfo;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;

// Review prompt on Android (2026-11-16, Sevaan: "all the same review prompts we have in iOS should also be in Android"):
// Google Play's in-app review card, the counterpart of the iOS ReviewPlugin (WidgetBridge.swift), same JS name "Review"
// and the same two methods. Like Apple, Google decides whether the card actually shows (a quota per person); the web app
// only asks at calm moments (js/main.js maybeAskReview). It only appears for installs from Google Play, so a sideloaded
// debug build gets nothing.
@CapacitorPlugin(name = "Review")
public class ReviewPlugin extends Plugin {
    @PluginMethod
    public void request(PluginCall call) {
        ReviewManager manager = ReviewManagerFactory.create(getContext());
        manager.requestReviewFlow().addOnCompleteListener(task -> {
            if (!task.isSuccessful()) { call.reject("Review not available"); return; }
            ReviewInfo info = task.getResult();
            getActivity().runOnUiThread(() -> manager.launchReviewFlow(getActivity(), info).addOnCompleteListener(done -> call.resolve()));
        });
    }

    // The app's page in the phone's settings, where notifications can be turned back on.
    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Couldn't open Settings");
        }
    }

    // An emulator, or one of Google Play's pre-launch test devices (Firebase Test Lab)? (Space Collector 8cd90a33,
    // 2026-11-19: Play's robots ran each upload on several devices and were counted as players in the usage stats;
    // js/field-notes.js marks these as tests.)
    @PluginMethod
    public void env(PluginCall call) {
        boolean lab = false;
        try { lab = "true".equals(Settings.System.getString(getContext().getContentResolver(), "firebase.test.lab")); } catch (Exception e) {}
        String f = Build.FINGERPRINT + " " + Build.MODEL + " " + Build.PRODUCT + " " + Build.HARDWARE;
        boolean emu = f.contains("generic") || f.contains("sdk_gphone") || f.contains("emulator") || f.contains("Emulator") || f.contains("goldfish") || f.contains("ranchu") || f.contains("Android SDK built for");
        JSObject r = new JSObject(); r.put("virtual", emu); r.put("lab", lab);
        call.resolve(r);
    }
}
