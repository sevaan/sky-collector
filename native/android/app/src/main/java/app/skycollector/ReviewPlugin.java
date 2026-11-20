package app.skycollector;

import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
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

    // App icons (2026-11-19, Plus; Space Collector's, 32524915): each icon is a launcher activity-alias
    // (AndroidManifest.xml). Enable the chosen one, disable the rest. "MainActivity" is the Original (the old launcher
    // name). Launchers can take a moment, and some close the app, to redraw the home screen.
    private static final String[] ICON_ALIASES = { "MainActivity", "IconFlightPlan", "IconNightFlight", "IconCheatline", "IconBlueprint", "IconGoldenAge", "IconAirmail", "IconCockpit" };
    private ComponentName alias(String n) { return new ComponentName(getContext().getPackageName(), "app.skycollector." + n); }

    @PluginMethod
    public void getIcon(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        String on = "MainActivity";
        for (String n : ICON_ALIASES) {
            if (n.equals("MainActivity")) continue;
            if (pm.getComponentEnabledSetting(alias(n)) == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) { on = n; break; }
        }
        JSObject r = new JSObject(); r.put("name", on.equals("MainActivity") ? null : on); call.resolve(r);
    }

    @PluginMethod
    public void setIcon(PluginCall call) {
        String want = call.getString("name"); if (want == null || want.isEmpty()) want = "MainActivity";
        boolean known = false; for (String n : ICON_ALIASES) if (n.equals(want)) known = true;
        if (!known) { call.reject("Unknown icon"); return; }
        PackageManager pm = getContext().getPackageManager();
        try {
            /* the new one first, so there is never a moment with no launcher entry */
            pm.setComponentEnabledSetting(alias(want), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
            for (String n : ICON_ALIASES) if (!n.equals(want)) pm.setComponentEnabledSetting(alias(n), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
            call.resolve();
        } catch (Exception e) { call.reject("Couldn't change the icon"); }
    }
}
