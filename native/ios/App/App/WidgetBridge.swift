import Foundation
import UIKit
import Capacitor
import WidgetKit
import StoreKit
import ActivityKit

// Widgets (2026-10-22, design/widgets.html): the web app hands over tonight's plan (js/main.js sendWidgets) and this
// saves it where the widget extension (SCWidgets) can read it: plan.json in the App Group "group.<app id>", with the
// small card pictures it names copied beside it as art/<name>.png (240 px, so the widget never decodes WebP or a big
// file). Then the widgets are asked to reload.
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "Widgets"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise),
    ]

    static var groupId: String { "group." + (Bundle.main.bundleIdentifier ?? "io.github.sevaan.spacecollector") }

    // The small card pictures a widget or the Live Activity names, copied into the shared container as art/<name>.png.
    static func copyArt(_ art: [String], to dir: URL) {
        let fm = FileManager.default, artDir = dir.appendingPathComponent("art", isDirectory: true)
        try? fm.createDirectory(at: artDir, withIntermediateDirectories: true)
        for rel in art {
            let name = ((rel as NSString).lastPathComponent as NSString).deletingPathExtension
            let out = artDir.appendingPathComponent(name + ".png")
            let src = Bundle.main.bundleURL.appendingPathComponent("public").appendingPathComponent(rel)
            // Re-make the copy when the app's picture is newer (2026-10-28, Sevaan: widgets kept the old art after
            // pictures were replaced under the same name). Each new build's files are newer, so this runs once per build.
            if let outDate = (try? fm.attributesOfItem(atPath: out.path))?[.modificationDate] as? Date,
               let srcDate = (try? fm.attributesOfItem(atPath: src.path))?[.modificationDate] as? Date,
               outDate >= srcDate { continue }
            guard let img = UIImage(contentsOfFile: src.path) else { continue }
            let side: CGFloat = 240, s = side / min(img.size.width, img.size.height)
            let size = CGSize(width: img.size.width * s, height: img.size.height * s)
            let fmt = UIGraphicsImageRendererFormat(); fmt.scale = 1
            let png = UIGraphicsImageRenderer(size: CGSize(width: side, height: side), format: fmt).pngData { _ in
                img.draw(in: CGRect(x: (side - size.width) / 2, y: (side - size.height) / 2, width: size.width, height: size.height)) // centre square
            }
            try? png.write(to: out)
        }
    }

    @objc func save(_ call: CAPPluginCall) {
        guard let plan = call.getString("plan"),
              let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Self.groupId) else {
            call.reject("No shared container"); return
        }
        let art = call.getArray("art", String.self) ?? []
        DispatchQueue.global(qos: .utility).async {
            Self.copyArt(art, to: dir)
            do {
                try plan.data(using: .utf8)?.write(to: dir.appendingPathComponent("plan.json"), options: .atomic)
            } catch { call.reject("Couldn't save the plan"); return }
            DispatchQueue.main.async { WidgetCenter.shared.reloadAllTimelines(); call.resolve() }
        }
    }
}

// Review prompt (2026-10-24, Sevaan): Apple's own "Enjoying Space Collector?" sheet. Apple decides whether it actually
// shows (at most three times a year; never in TestFlight, always in a simulator/Xcode build). The web app only calls
// this at calm moments (js/main.js maybeAskReview). Lives in this file so the Xcode project needs no new entry.
public class ReviewPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ReviewPlugin"
    public let jsName = "Review"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "env", returnType: CAPPluginReturnPromise),
    ]
    // Is this the Simulator? (Space Collector 8cd90a33, 2026-11-19: simulator playtests of store builds were counted as
    // players in the usage stats; js/field-notes.js marks them as tests.)
    @objc func env(_ call: CAPPluginCall) {
        #if targetEnvironment(simulator)
        call.resolve(["virtual": true])
        #else
        call.resolve(["virtual": false])
        #endif
    }
    // The phone's Settings page for this app, where notifications can be turned back on (iOS playtest 2026-11-10: an
    // app-settings: link from the web view did nothing, so it opens from here).
    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString) else { call.reject("No settings URL"); return }
            UIApplication.shared.open(url, options: [:]) { ok in ok ? call.resolve() : call.reject("Couldn't open Settings") }
        }
    }
    @objc func request(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let scene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene else {
                call.reject("No active window"); return
            }
            if #available(iOS 16.0, *) { AppStore.requestReview(in: scene) } else { SKStoreReviewController.requestReview(in: scene) }
            call.resolve()
        }
    }
}

// Live Activity for a pass (2026-11-10, Sevaan; notes/FEATURING-PLAN.md step 3): the pass the player is following
// counts down on the Lock Screen and in the Dynamic Island. The views live in the widget extension (SCWidgets.swift,
// "Live Activity"); this starts, updates and ends it from the web app (js/main.js startLivePass). These two types
// must keep the same names and fields as the extension's PassActivityAttributes and Pass.
struct LivePass: Codable, Hashable {
    let key: String, name: String, tier: String, icon: Bool, art: String?
    let start: Double, end: Double, `where`: String, short: String, kick: String, cloud: Bool
    var startDate: Date { Date(timeIntervalSince1970: start / 1000) }
    var endDate: Date { Date(timeIntervalSince1970: end / 1000) }
}
@available(iOS 16.2, *)
struct PassActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable { var phase: String; var next: String? } // soon | up | over
    var pass: LivePass
}
public class PassActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PassActivityPlugin"
    public let jsName = "PassActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "supported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "phase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "tidy", returnType: CAPPluginReturnPromise),
    ]
    // Whether this phone can show one, and the player hasn't turned Live Activities off for the app in iOS Settings.
    @objc func supported(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) { call.resolve(["on": ActivityAuthorizationInfo().areActivitiesEnabled]) } else { call.resolve(["on": false]) }
    }
    // One at a time: starting a pass replaces whatever was showing.
    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.reject("Needs iOS 16.2"); return }
        guard let json = call.getString("pass"), let data = json.data(using: .utf8), let pass = try? JSONDecoder().decode(LivePass.self, from: data) else { call.reject("No pass"); return }
        let art = call.getString("art")
        Task {
            for a in Activity<PassActivityAttributes>.activities { await a.end(nil, dismissalPolicy: .immediate) }
            if let rel = art, let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: WidgetBridgePlugin.groupId) { WidgetBridgePlugin.copyArt([rel], to: dir) }
            let up = Date() >= pass.startDate
            // Stale at the end of the pass: the one redraw iOS gives without the app, spent on saying it's gone.
            let content = ActivityContent(state: PassActivityAttributes.ContentState(phase: up ? "up" : "soon", next: nil), staleDate: pass.endDate, relevanceScore: 100)
            do { let act = try Activity.request(attributes: PassActivityAttributes(pass: pass), content: content, pushType: nil); call.resolve(["id": act.id]) }
            catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func phase(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        let ph = call.getString("phase") ?? "up", next = call.getString("next")
        Task {
            for a in Activity<PassActivityAttributes>.activities {
                await a.update(ActivityContent(state: PassActivityAttributes.ContentState(phase: ph, next: next), staleDate: ph == "over" ? nil : a.attributes.pass.endDate))
            }
            call.resolve()
        }
    }
    // Says it's gone (with what's next, if anything) and leaves the Lock Screen a little later.
    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        let next = call.getString("next"), after = call.getDouble("after") ?? 120
        Task {
            for a in Activity<PassActivityAttributes>.activities {
                await a.end(ActivityContent(state: PassActivityAttributes.ContentState(phase: "over", next: next), staleDate: nil), dismissalPolicy: after <= 0 ? .immediate : .after(Date().addingTimeInterval(after)))
            }
            call.resolve()
        }
    }
    // On opening the app: clear any whose pass is over, and say which one (if any) is still running.
    @objc func tidy(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        Task {
            var live: LivePass? = nil
            for a in Activity<PassActivityAttributes>.activities {
                if a.attributes.pass.endDate <= Date() || a.activityState == .ended || a.activityState == .dismissed { await a.end(nil, dismissalPolicy: .immediate) } else { live = a.attributes.pass }
            }
            if let p = live { call.resolve(["key": p.key, "start": p.start, "end": p.end]) } else { call.resolve() }
        }
    }
}
