import WidgetKit
import SwiftUI
import ActivityKit

// Sky Collector widgets (2026-11-19, review Part 2 I, the spec Sevaan approved): Space Collector's widgets
// (2026-10-22, design/widgets.html style A) with the same layouts, fed with your regulars instead of satellite passes.
// A regular is an airline flight that passes over you at about the same time most days (js/sky-regulars.js); private
// and other anonymous aircraft never become regulars, so a widget only ever names an airline flight. The app writes
// the plan in Space's shape (js/main.js sendSkyWidgets), plus `dark` (when the sky is dark: paper by day, navy at
// night, like the app) and `streak`. Space's notes follow.
// Space Collector widgets (2026-10-22, Sevaan; design/widgets.html, style A: the card's picture sits in the target
// circle and the circle's ring counts down to the pass). One idea in every size: what to look up for next, and when.
// The app writes tonight's plan (js/main.js sendWidgets → App/WidgetBridge.swift) to plan.json in the shared App Group,
// with the small card pictures as art/<name>.png. The widget steps through it by itself: `chain` is the next catch from
// each moment on, so countdowns stay right all night without the app. Every widget comes with Plus (2026-10-22, Sevaan);
// without it they show what Plus is, and the widget gallery shows a sample night.

// MARK: - The plan

struct Pass: Codable, Hashable {
    let key: String, name: String, tier: String, icon: Bool, art: String?
    let start: Double, end: Double, `where`: String, short: String, kick: String, cloud: Bool
    var tag: String? = nil    // Sky: the callsign, for the lock screen ("ACA856")
    var fresh: Bool? = nil    // Sky: a regular whose flight card you don't have yet
    var startDate: Date { Date(timeIntervalSince1970: start / 1000) }
    var endDate: Date { Date(timeIntervalSince1970: end / 1000) }
    var url: URL { URL(string: "skycollector://today")! } // Sky: Today, where your regulars are
}
struct Streak: Codable { let weeks: Int; let thisWeek: Bool }
struct Step: Codable { let from: Double; let pass: Pass }
struct Haul: Codable { let n: Int; let top: String?; let topN: Int }
struct Wx: Codable { let ok: Bool; let line: String; let next: String }
struct Plan: Codable {
    let at: Double, place: String, plus: Bool, dusk: Double?, dawn: Double, eve: Double
    let chain: [Step], list: [Pass], run: [Pass], back: Double?, haul: Haul, bars: [Double], wx: Wx?, missions: Int
    let clock: String? // the app's Settings → Clock: "12", "24" or "auto" (2026-10-25: the widget used the phone's own)
    var sky: Int? = nil
    var streak: Streak? = nil
    var dark: [[Double]]? = nil // Sky: [from, to] when the sky is dark over the next day (ms)
    func isDark(_ d: Date) -> Bool {
        let t = d.timeIntervalSince1970 * 1000
        if let dk = dark { return dk.contains { $0.count == 2 && $0[0] <= t && t < $0[1] } }
        let h = Calendar.current.component(.hour, from: d); return h < 7 || h >= 18
    }
    var duskDate: Date? { dusk.map { Date(timeIntervalSince1970: $0 / 1000) } }
    var dawnDate: Date { Date(timeIntervalSince1970: dawn / 1000) }
}

enum Store {
    static var dir: URL? {
        let id = (Bundle.main.bundleIdentifier ?? "").replacingOccurrences(of: ".widgets", with: "")
        return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group." + id)
    }
    static func plan() -> Plan? {
        guard let d = dir, let data = try? Data(contentsOf: d.appendingPathComponent("plan.json")) else { return nil }
        let plan = try? JSONDecoder().decode(Plan.self, from: data)
        WidgetClock.pref = plan?.clock
        return plan
    }
    static func art(_ name: String?) -> UIImage? {
        guard let n = name, let d = dir else { return nil }
        return UIImage(contentsOfFile: d.appendingPathComponent("art/\(n).png").path)
    }
}

// What a widget shows at a given moment.
enum Moment {
    case day(dusk: Date, head: Pass?)   // before dark: counting to dark, tonight's headliner named
    case next(Pass)                     // the next catch, counting down
    case upNow(Pass)                    // it's up: where to look
    case cloudy(Wx)                     // no countdown on a cloudy night
    case late(back: Date?)              // Sky: no regular due (a quiet sky); Space: satellites are in Earth's shadow
    case noPlan                         // the app hasn't planned tonight
}
func moment(_ plan: Plan?, at d: Date) -> Moment {
    guard let p = plan, d < p.dawnDate, d.timeIntervalSince1970 * 1000 - p.at < 20 * 3600_000 else { return .noPlan }
    if p.sky == nil, let w = p.wx, !w.ok { return .cloudy(w) } // Sky: planes fly in cloud too, so no cloudy state
    let step = p.chain.last { Date(timeIntervalSince1970: $0.from / 1000) <= d && $0.pass.endDate > d }
        ?? p.chain.first { $0.pass.endDate > d }
    if p.sky == nil, let dusk = p.duskDate, d < dusk.addingTimeInterval(-45 * 60), (step == nil || step!.pass.startDate > dusk.addingTimeInterval(-45 * 60)) {
        return .day(dusk: dusk, head: p.chain.first { $0.pass.kick == "headliner" }?.pass ?? step?.pass)
    }
    if let s = step { return d >= s.pass.startDate ? .upNow(s.pass) : .next(s.pass) }
    return .late(back: p.back.map { Date(timeIntervalSince1970: $0 / 1000) }.flatMap { $0 > d ? $0 : nil })
}

// MARK: - Timeline

struct Entry: TimelineEntry { let date: Date; let plan: Plan? }

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { Entry(date: .now, plan: Sample.plan) }
    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(Entry(date: .now, plan: context.isPreview ? Sample.plan : Store.plan())) // the gallery always shows what you'd get
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        let plan = Store.plan(), now = Date()
        // A new entry wherever what's shown changes: each pass starting and ending, dark, dawn, plus every 30 minutes.
        var dates: Set<Date> = [now]
        if let p = plan {
            for s in p.chain { dates.insert(Date(timeIntervalSince1970: s.from / 1000)); dates.insert(s.pass.startDate); dates.insert(s.pass.endDate) }
            if let d = p.duskDate { dates.insert(d.addingTimeInterval(-45 * 60)); dates.insert(d) }
            dates.insert(p.dawnDate)
            for d in p.dark ?? [] { for x in d { dates.insert(Date(timeIntervalSince1970: x / 1000)) } }
            if p.sky != nil, let next = p.chain.map(\.pass.startDate).first(where: { $0 > now }) { // Sky: whole minutes, so a step each time the count drops a minute, up to 3 h before the regular
                for k in 1...180 { let u = next.addingTimeInterval(-60 * Double(k)); if u > now { dates.insert(u) } }
            }
            var t = now; while t < p.dawnDate { t = t.addingTimeInterval(1800); dates.insert(t) }
        }
        let list = dates.filter { $0 >= now.addingTimeInterval(-1) }.sorted().prefix(240)
        let entries = list.map { Entry(date: $0, plan: plan) }
        completion(Timeline(entries: Array(entries), policy: .after((list.last ?? now).addingTimeInterval(1800))))
    }
}

// MARK: - Look

extension UIColor {
    convenience init(hex: UInt32) { self.init(red: CGFloat(hex >> 16 & 255) / 255, green: CGFloat(hex >> 8 & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: 1) }
}
extension Color {
    init(hex: UInt32, a: Double = 1) { self.init(.sRGB, red: Double(hex >> 16 & 255) / 255, green: Double(hex >> 8 & 255) / 255, blue: Double(hex & 255) / 255, opacity: a) }
    // Sky's two looks: paper by day, navy after dark. The widget sets its colour scheme from the plan's dark times
    // (SCWidgetView), so these follow the sky, not the phone's own setting.
    init(day: UInt32, night: UInt32) { self.init(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: night) : UIColor(hex: day) }) }
    static let navy = Color(day: 0xfffdf6, night: 0x0b1626)      // the background: paper / navy
    static let ink = Color(day: 0x0d2238, night: 0xfff3dc)       // names and big numbers
    static let cream = Color(day: 0x0d2238, night: 0xf3ead0)     // rows
    static let muted = Color(day: 0x4a6178, night: 0x9fb3c6)
    static let orange = Color(day: 0xb42a20, night: 0xff6b5e)    // Sky's red: text red by day, light red at night
    static let ring = Color(day: 0xd7362b, night: 0xff6b5e)
    static let line = Color(day: 0xe4dccb, night: 0x22324a)
    static let well = Color(day: 0xe8eff5, night: 0x15233a)      // an empty picture
    static let bar = Color(day: 0xcfdbe6, night: 0x2c4060)
    static let gold = Color(hex: 0xf2c14e)
}
enum Tier {
    static func color(_ t: String) -> Color {
        switch t { case "uncommon": return Color(day: 0x2f9e5b, night: 0x5fd08a); case "rare": return Color(day: 0x2f6fd6, night: 0x4aa8ff); case "epic": return Color(day: 0x8a4fd0, night: 0xe46ad6); case "legendary": return Color(day: 0xc9901a, night: 0xffc545); default: return Color(day: 0x6f7c8c, night: 0x9aa4b1) }
    }
    static func gem(_ t: String) -> String { ["common": "●", "uncommon": "▲", "rare": "◆", "epic": "✦", "legendary": "★"][t] ?? "●" }
    static func label(_ t: String) -> String { t.capitalized }
}
extension Font {
    static func display(_ s: CGFloat) -> Font { .custom("RussoOne-Regular", size: s) }
    static func label(_ s: CGFloat) -> Font { .custom("BarlowCondensed-Medium", size: s) }
}
struct Lab: View {
    let text: String; var color: Color = .ink.opacity(0.8); var size: CGFloat = 11
    var body: some View { Text(text.uppercased()).font(.label(size)).tracking(size * 0.16).foregroundStyle(color).lineLimit(1) }
}
struct TierLine: View {
    let pass: Pass; var size: CGFloat = 11
    var body: some View {
        HStack(spacing: 4) {
            Text(pass.icon || pass.fresh == true ? Tier.gem(pass.tier) : "\(Tier.gem(pass.tier)) \(Tier.label(pass.tier).uppercased())").font(.label(size)).tracking(size * 0.14).foregroundStyle(Tier.color(pass.tier)) // Sky: a new one is its gem and NEW (the word cut to "UN…" beside the pill in the small widget)
            if pass.icon { Text("ICON").font(.label(size - 2)).tracking(1).foregroundStyle(Color(hex: 0x1b1405)).padding(.horizontal, 4).background(Color.gold, in: RoundedRectangle(cornerRadius: 4)) }
            if pass.fresh == true { Text("NEW").font(.label(size - 2)).tracking(1).foregroundStyle(Color.white).padding(.horizontal, 4).background(Color.ring, in: RoundedRectangle(cornerRadius: 4)) }
        }.lineLimit(1)
    }
}
// Times follow the app's Clock setting; "auto" (or an older plan without it) follows the phone, as before.
enum WidgetClock { static var pref: String? }
func timeText(_ d: Date) -> Text {
    guard let p = WidgetClock.pref, p == "12" || p == "24" else { return Text(d, style: .time) }
    let f = DateFormatter(); f.locale = Locale.current; f.dateFormat = p == "24" ? "HH:mm" : "h:mm a"
    return Text(f.string(from: d))
}

// Sky (2026-11-19, Boss Maxx for the approved design): a regular's time is "usually 6:28 PM", so its countdown is in
// whole minutes ("12 min", "1 h 05"), never a ticking m:ss that claims a precision the data doesn't have. The timeline
// has an entry each minute before a regular is due, so it counts down without the app.
func minutesText(to d: Date, from now: Date) -> String {
    let m = max(0, Int((d.timeIntervalSince(now) / 60).rounded(.up)))
    return m >= 60 ? "\(m / 60) h \(String(format: "%02d", m % 60))" : "\(m) min"
}

// The target circle with the card's picture in it; the ring empties over the last hour before the pass.
struct RingArt: View {
    let pass: Pass?; var size: CGFloat = 62; var full = false; var until: Date? = nil
    var body: some View {
        ZStack {
            if let img = Store.art(pass?.art) {
                Circle().fill(Color.well).frame(width: size - 14, height: size - 14) // behind a silhouette's clear corners
                Image(uiImage: img).resizable().scaledToFill().frame(width: size - 14, height: size - 14).clipShape(Circle())
            } else {
                Circle().fill(Color.well).frame(width: size - 14, height: size - 14)
                Image(systemName: "airplane").font(.system(size: size * 0.26, weight: .semibold)).foregroundStyle(Color.ring)
            }
            Circle().stroke(Color.ink.opacity(0.12), lineWidth: 2.5)
            if full {
                Circle().stroke(Color.ring, lineWidth: 2.5)
            } else if let t = until ?? pass?.startDate {
                ProgressView(timerInterval: t.addingTimeInterval(-3600)...t, countsDown: true, label: { EmptyView() }, currentValueLabel: { EmptyView() })
                    .progressViewStyle(.circular).tint(Color.ring)
            }
            ForEach(0..<4) { i in
                Rectangle().fill(Color.ring).frame(width: 2, height: 5).offset(y: -size / 2 + 3).rotationEffect(.degrees(Double(i) * 90))
            }
        }.frame(width: size, height: size)
    }
}
struct Stars: View {
    var body: some View {
        Canvas { ctx, sz in
            for (x, y, r) in [(0.12, 0.18, 1.0), (0.72, 0.12, 0.9), (0.88, 0.44, 1.2), (0.34, 0.62, 0.8), (0.58, 0.84, 0.9), (0.08, 0.88, 0.8), (0.46, 0.08, 0.7), (0.94, 0.9, 0.8)] {
                ctx.fill(Path(ellipseIn: CGRect(x: x * sz.width, y: y * sz.height, width: r * 1.6, height: r * 1.6)), with: .color(.white.opacity(0.45)))
            }
        }
    }
}

// MARK: - Small (free): the next catch

struct NextCatch: View {
    let m: Moment; var compact = false; var now: Date = .now
    var body: some View {
        let ring: CGFloat = compact ? 54 : 62
        VStack(alignment: .leading, spacing: 0) {
            switch m {
            case .next(let p), .upNow(let p):
                let up: Bool = { if case .upNow = m { return true }; return false }()
                Lab(text: up ? "Due now" : "Next regular")
                HStack(spacing: 9) {
                    RingArt(pass: p, size: ring, full: up)
                    VStack(alignment: .leading, spacing: 3) {
                        TierLine(pass: p, size: 10)
                        Text(p.name).font(.display(compact ? 14 : 15)).foregroundStyle(Color.ink).lineLimit(3).minimumScaleFactor(0.6).fixedSize(horizontal: false, vertical: true)
                    }
                }.padding(.top, 7)
                Spacer(minLength: 2)
                if up {
                    Text("LOOK UP").font(.display(27)).foregroundStyle(Color.orange)
                    (Text("Usually ") + timeText(p.startDate) + Text(p.where.isEmpty ? "" : " · \(p.where)"))
                        .font(.label(12)).foregroundStyle(Color.muted).lineLimit(1).minimumScaleFactor(0.8)
                } else {
                    Text(minutesText(to: p.startDate, from: now)).font(.display(32)).foregroundStyle(Color.orange).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
                    (Text("Usually ") + timeText(p.startDate) + Text(p.where.isEmpty ? "" : " · \(p.where)"))
                        .font(.label(12)).foregroundStyle(Color.muted).lineLimit(1).minimumScaleFactor(0.8)
                }
            case .day(let dusk, let head):
                Lab(text: head?.kick == "headliner" ? "Tonight's headliner" : "Tonight")
                if let h = head {
                    HStack(spacing: 9) {
                        RingArt(pass: h, size: ring, full: true)
                        VStack(alignment: .leading, spacing: 3) {
                            TierLine(pass: h, size: 10)
                            Text(h.name).font(.display(compact ? 13 : 14)).foregroundStyle(Color.ink).lineLimit(3).minimumScaleFactor(0.75).fixedSize(horizontal: false, vertical: true)
                        }
                    }.padding(.top, 7)
                }
                Spacer(minLength: 2)
                Lab(text: "Dark in", color: .muted, size: 10)
                Text(timerInterval: Date.now...dusk, countsDown: true).font(.display(28)).foregroundStyle(Color.ink).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
                if let h = head {
                    (Text("Up at ") + timeText(h.startDate) + Text(" · \(h.short)")).font(.label(12)).foregroundStyle(Color.muted).lineLimit(1)
                } else {
                    (Text("Dark at ") + timeText(dusk)).font(.label(12)).foregroundStyle(Color.muted)
                }
            case .cloudy(let w):
                Lab(text: "Tonight")
                Spacer(minLength: 2)
                Image(systemName: "cloud.fill").font(.system(size: 26)).foregroundStyle(Color(hex: 0xaab4c2))
                Text("Cloudy tonight").font(.display(16)).foregroundStyle(Color.ink).padding(.top, 4)
                if !w.next.isEmpty { (Text("Next clear night: ") + Text(w.next.capitalized).foregroundStyle(Color.ink)).font(.label(12)).foregroundStyle(Color.muted) }
                Text("Watch for a break").font(.label(12)).foregroundStyle(Color.muted)
            case .late(let back):
                Lab(text: "Quiet sky")
                Spacer(minLength: 2)
                Text("No regulars due").font(.display(16)).foregroundStyle(Color.ink).lineLimit(2)
                if let b = back {
                    Lab(text: "Next regular", color: .muted, size: 10).padding(.top, 4)
                    timeText(b).font(.display(26)).foregroundStyle(Color.orange)
                } else {
                    Text("Flights that pass most days show up here after a few days of looking up").font(.label(12)).foregroundStyle(Color.muted).lineLimit(3).minimumScaleFactor(0.8)
                }
            case .noPlan:
                Spacer()
                HStack { Spacer(); RingArt(pass: nil, size: 40, full: true); Spacer() }
                Text("Find your regulars").font(.display(15)).foregroundStyle(Color.ink).frame(maxWidth: .infinity).padding(.top, 8)
                Text("Open Sky Collector to see what flies over you").font(.label(12)).foregroundStyle(Color.muted).multilineTextAlignment(.center).frame(maxWidth: .infinity)
                Spacer()
            }
        }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

// MARK: - Medium and large (Plus)

struct PassRow: View {
    let p: Pass; var art = false; var lead = false
    var body: some View {
        Link(destination: p.url) {
            HStack(spacing: 8) {
                timeText(p.startDate).font(.display(13)).foregroundStyle(lead ? Color.orange : Color.cream).frame(width: 46, alignment: .leading).lineLimit(1).minimumScaleFactor(0.7)
                if art {
                    Group { if let img = Store.art(p.art) { ZStack { Color.well; Image(uiImage: img).resizable().scaledToFill() } } else { ZStack { Color.well; Image(systemName: "airplane").font(.system(size: 11, weight: .semibold)).foregroundStyle(Color.muted) } } }
                        .frame(width: 26, height: 26).clipShape(Circle()).overlay(Circle().stroke(lead ? Color.ring : Color.ink.opacity(0.15), lineWidth: 1.5))
                }
                VStack(alignment: .leading, spacing: 0) {
                    Text(p.name).font(.label(14)).foregroundStyle(Color.cream).lineLimit(1).minimumScaleFactor(0.75)
                    Text(art ? "\(Tier.label(p.tier))\(p.fresh == true ? " · new" : "") · \(p.short)" : p.short).font(.label(12)).foregroundStyle(Color.muted).lineLimit(1)
                }
                Spacer(minLength: 4)
                Text(Tier.gem(p.tier)).font(.system(size: 10)).foregroundStyle(Tier.color(p.tier))
            }.padding(.vertical, 5).overlay(alignment: .top) { Rectangle().fill(Color.line).frame(height: 1) }
        }
    }
}
func wxWord(_ p: Plan) -> String { guard let w = p.wx else { return "" }; return w.ok ? "Clear" : "Cloudy" }

struct Medium: View {
    let plan: Plan; let m: Moment; let now: Date
    var body: some View {
        let main: Pass? = { switch m { case .next(let p), .upNow(let p): return p; default: return nil } }()
        let after = plan.list.filter { $0.endDate > now && $0.key != main?.key }.prefix(3) // what's next tonight, before or after the main pick (2026-10-22: rows only after the headliner left the list empty)
        HStack(spacing: 13) {
            NextCatch(m: m, compact: true, now: now).frame(width: 140)
            Rectangle().fill(Color.line).frame(width: 1)
            VStack(alignment: .leading, spacing: 4) {
                HStack { Lab(text: "Then", color: .orange); Spacer(); if plan.wx != nil { Lab(text: "☾ " + wxWord(plan), color: .cream, size: 11) } }
                if after.isEmpty {
                    Spacer(); Text("No other regulars due").font(.label(13)).foregroundStyle(Color.muted); Spacer()
                } else {
                    ForEach(Array(after), id: \.self) { PassRow(p: $0) }
                    Spacer(minLength: 0)
                }
            }
        }
    }
}

struct Large: View {
    let plan: Plan; let now: Date
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack { Lab(text: plan.place.isEmpty ? "Your sky" : "Your sky · \(plan.place)", color: .orange); Spacer(); if plan.wx != nil { Lab(text: "☾ " + wxWord(plan), color: .cream) } }
            if let w = plan.wx, !w.ok {
                Text(w.line).font(.display(19)).foregroundStyle(Color.ink).lineLimit(2).padding(.top, 8)
                Text(w.next.isEmpty ? "Watch for a break in the cloud" : "Next clear night: \(w.next)").font(.label(13)).foregroundStyle(Color.muted)
            } else {
                (Text(plan.sky != nil && plan.list.isEmpty ? "No regulars yet" /* Sky: not "0 regulars due" */ : plan.haul.n == 0 ? "\(plan.list.count) regular\(plan.list.count == 1 ? "" : "s") due" : "\(plan.haul.n) new card\(plan.haul.n == 1 ? "" : "s") due") + (plan.haul.top.map { Text(", ") + Text("\(plan.haul.topN) \(Tier.label($0))").foregroundStyle(Tier.color($0)) } ?? Text("")))
                    .font(.display(21)).foregroundStyle(Color.ink).lineLimit(1).minimumScaleFactor(0.7).padding(.top, 8)
                if let d = plan.duskDate { (Text("Dark ") + timeText(d) + Text(" · until ") + timeText(plan.dawnDate)).font(.label(13)).foregroundStyle(Color.muted) }
                else { Text("Planes over you today, by hour").font(.label(13)).foregroundStyle(Color.muted) }
            }
            Chart(plan: plan, now: now).frame(height: 40).padding(.top, 8)
            HStack { Lab(text: "12 AM", color: .muted, size: 10); Spacer(); Lab(text: "Noon", color: .muted, size: 10); Spacer(); Lab(text: "11 PM", color: .muted, size: 10) }.padding(.top, 3)
            let stops = plan.run.filter { $0.endDate > now }
            VStack(spacing: 0) {
                ForEach(Array(stops.prefix(4).enumerated()), id: \.element) { i, p in PassRow(p: p, art: true, lead: i == 0) }
            }.padding(.top, 8)
            if stops.isEmpty { Text(plan.sky != nil && plan.list.isEmpty ? "Flights that pass over you most days show up here after a few days of looking up" : "No regulars due today").font(.label(13)).foregroundStyle(Color.muted).padding(.top, 10) }
            Spacer(minLength: 0)
            HStack {
                Lab(text: plan.missions > 0 ? "\(plan.missions) mission\(plan.missions == 1 ? "" : "s") left" : "Missions done", color: .muted, size: 10)
                Spacer(); Lab(text: "Open the sky ›", color: .ink, size: 10)
            }.padding(.top, 6).overlay(alignment: .top) { Rectangle().fill(Color.line).frame(height: 1) }
        }
    }
}
struct Chart: View {
    let plan: Plan; let now: Date
    var body: some View {
        let mx = max(plan.bars.max() ?? 1, 1), pk = plan.bars.firstIndex(of: mx) ?? -1
        let a = plan.dusk ?? plan.at, b = plan.dawn, nowI = plan.bars.count == 24 ? Calendar.current.component(.hour, from: now) /* Sky: today's 24 hours */ : Int(((now.timeIntervalSince1970 * 1000 - a) / max(b - a, 1)) * 16)
        HStack(alignment: .bottom, spacing: plan.bars.count > 16 ? 2 : 3) {
            ForEach(Array(plan.bars.enumerated()), id: \.offset) { i, v in
                RoundedRectangle(cornerRadius: 1.5).fill(i == pk ? Color.ring : i == nowI ? Color.ink : Color.bar)
                    .frame(maxWidth: .infinity).frame(height: max(3, 40 * v / mx))
            }
        }
    }
}

struct PlusOnly: View {
    var compact = false
    var body: some View {
        VStack(spacing: 6) {
            RingArt(pass: nil, size: 40, full: true)
            Text(compact ? "Plus" : "Sky Collector Plus").font(.display(15)).foregroundStyle(Color.ink)
            Text(Store.plan()?.sky != nil ? "This size comes with Plus. The small one is free." : "Widgets come with Plus. Tap to see what's in it.").font(.label(13)).foregroundStyle(Color.muted).multilineTextAlignment(.center)
        }.frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Lock screen (Plus)

func shortName(_ p: Pass) -> String {
    if let t = p.tag, !t.isEmpty { return t } // Sky: the callsign
    let n = p.name, w = n.split(separator: " ").first.map(String.init) ?? n
    return n.hasPrefix("Space Station") || n.hasPrefix("International Space Station") ? "ISS" : String(w.prefix(7))
}
struct LockView: View {
    @Environment(\.widgetFamily) var family
    let plan: Plan?; let m: Moment; var now: Date = .now
    var body: some View {
        if plan?.plus != true {
            switch family {
            case .accessoryInline: Text("Sky Collector Plus")
            case .accessoryCircular: ZStack { AccessoryWidgetBackground(); Text("PLUS").font(.system(size: 12, weight: .bold)) }
            default: VStack(alignment: .leading) { Text("Sky Collector").font(.headline); Text("Lock screen widgets come with Plus").font(.caption) }
            }
        } else {
            switch family {
            case .accessoryInline: inline
            case .accessoryCircular: circular
            default: rectangular
            }
        }
    }
    @ViewBuilder var inline: some View {
        switch m {
        case .next(let p): Text("✈ \(shortName(p)) ") + timeText(p.startDate) + Text(p.where.isEmpty ? "" : " · \(p.where)")
        case .upNow(let p): Text("✈ \(shortName(p)) due now · look up")
        case .day(let dusk, _): Text("☾ Dark at ") + timeText(dusk)
        case .cloudy: Text("☁ Cloudy tonight")
        case .late(let back): back.map { Text("✈ Next regular ") + timeText($0) } ?? Text("✈ Quiet sky")
        case .noPlan: Text("Sky Collector: find your regulars")
        }
    }
    @ViewBuilder var circular: some View {
        switch m {
        case .next(let p):
            ProgressView(timerInterval: p.startDate.addingTimeInterval(-3600)...p.startDate, countsDown: true) { EmptyView() } currentValueLabel: {
                VStack(spacing: 0) { Text(shortName(p)).font(.system(size: 9, weight: .semibold)); Text(minutesText(to: p.startDate, from: now)).font(.system(size: 11, weight: .bold)).monospacedDigit().multilineTextAlignment(.center).minimumScaleFactor(0.7) }
            }.progressViewStyle(.circular)
        case .upNow(let p):
            ZStack { AccessoryWidgetBackground(); VStack(spacing: 0) { Text(shortName(p)).font(.system(size: 9, weight: .semibold)); Text("UP").font(.system(size: 16, weight: .bold)) } }
        case .day(let dusk, _):
            ZStack { AccessoryWidgetBackground(); VStack(spacing: 0) { Text("DARK").font(.system(size: 9, weight: .semibold)); timeText(dusk).font(.system(size: 12, weight: .bold)).minimumScaleFactor(0.6) } }
        case .cloudy: ZStack { AccessoryWidgetBackground(); Image(systemName: "cloud.fill").font(.system(size: 20)) }
        case .late, .noPlan: ZStack { AccessoryWidgetBackground(); Image(systemName: "airplane").font(.system(size: 20)) }
        }
    }
    @ViewBuilder var rectangular: some View {
        VStack(alignment: .leading, spacing: 1) {
            switch m {
            case .next(let p):
                Text("✈ NEXT REGULAR").font(.system(size: 12, weight: .semibold)).opacity(0.8)
                Text(p.name).font(.headline).lineLimit(1).minimumScaleFactor(0.7)
                (timeText(p.startDate) + Text(" · \(p.short)")).font(.system(size: 13, weight: .semibold)).opacity(0.8).lineLimit(1).minimumScaleFactor(0.8)
                ProgressView(timerInterval: p.startDate.addingTimeInterval(-3600)...p.startDate, countsDown: true) { EmptyView() } currentValueLabel: { EmptyView() }
            case .upNow(let p):
                Text("✈ DUE NOW").font(.system(size: 12, weight: .semibold)).opacity(0.8)
                Text(p.name).font(.headline).lineLimit(1).minimumScaleFactor(0.7)
                Text(p.where.isEmpty ? "Look up" : "Look up · \(p.where)").font(.system(size: 13, weight: .semibold)).opacity(0.8).lineLimit(1)
            case .day(let dusk, let head):
                Text(head?.kick == "headliner" ? "◎ HEADLINER" : "☾ TONIGHT").font(.system(size: 12, weight: .semibold)).opacity(0.8)
                if let h = head {
                    Text(h.name).font(.headline).lineLimit(1).minimumScaleFactor(0.7)
                    (timeText(h.startDate) + Text(" · \(h.short)")).font(.system(size: 13, weight: .semibold)).opacity(0.8).lineLimit(1).minimumScaleFactor(0.8)
                } else {
                    (Text("Dark at ") + timeText(dusk)).font(.headline)
                }
            case .cloudy(let w):
                Text("☁ TONIGHT").font(.system(size: 12, weight: .semibold)).opacity(0.8)
                Text("Cloudy tonight").font(.headline)
                if !w.next.isEmpty { Text("Next clear night: \(w.next)").font(.system(size: 13, weight: .semibold)).opacity(0.8) }
            case .late(let back):
                Text("✈ QUIET SKY").font(.system(size: 12, weight: .semibold)).opacity(0.8)
                Text("No regulars due").font(.headline)
                if let b = back { (Text("Next regular ") + timeText(b)).font(.system(size: 13, weight: .semibold)).opacity(0.8) }
            case .noPlan:
                Text("SKY COLLECTOR").font(.system(size: 12, weight: .semibold)).opacity(0.8)
                Text("Find your regulars").font(.headline)
                Text("Open the app to see what flies over").font(.system(size: 13, weight: .semibold)).opacity(0.8)
            }
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - The widget

struct SCWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: Entry
    var body: some View {
        let m = moment(entry.plan, at: entry.date)
        let link: URL = { switch m { case .next(let p), .upNow(let p): return p.url; default: return URL(string: "skycollector://today")! } }()
        let home = family == .systemSmall || family == .systemMedium || family == .systemLarge, dark = (entry.plan ?? Sample.plan).isDark(entry.date)
        Group {
            switch family {
            case .systemSmall:
                if let p = entry.plan, !p.plus, p.sky == nil { PlusOnly(compact: true) } else { NextCatch(m: m, now: entry.date) } // Sky: the small widget is free (the approved spec)
            case .systemMedium:
                if let p = entry.plan, p.plus { Medium(plan: p, m: m, now: entry.date) } else if entry.plan == nil { NextCatch(m: m, now: entry.date) } else { PlusOnly() }
            case .systemLarge:
                if let p = entry.plan, p.plus { Large(plan: p, now: entry.date) } else if entry.plan == nil { NextCatch(m: m, now: entry.date) } else { PlusOnly() }
            default: LockView(plan: entry.plan, m: m, now: entry.date)
            }
        }
        .padding(home ? 14 : 0)
        .widgetURL(entry.plan?.plus == false && !(family == .systemSmall && entry.plan?.sky != nil) ? URL(string: "skycollector://plus")! : link)
        .containerBackground(for: .widget) {
            if home { ZStack { dark ? Color(hex: 0x0b1626) : Color(hex: 0xfffdf6); if dark { Stars() } } } else { Color.clear } // fixed colours: the background is drawn outside the colour scheme set below (simulator 2026-11-19: paper behind night text)
        }
        .environment(\.colorScheme, !home || dark ? .dark : .light) // the home screen follows the sky; the lock screen tints it its own way
    }
}

// MARK: - Live Activity: the pass you're following, on the Lock Screen and in the Dynamic Island
// (2026-11-10, Sevaan; notes/FEATURING-PLAN.md step 3). The app starts it when the player taps Show me on a pass or
// sets a reminder for one (js/main.js startLivePass → App/WidgetBridge.swift PassActivityPlugin). It counts down to
// the rise, then shows where to look and how long is left, then says it's gone.
//
// A Live Activity is only redrawn when the app updates it or when it goes stale, never on a clock. So everything that
// moves is a system timer (the countdown and the bar tick by themselves), and the one free redraw, the stale date, is
// spent on the end of the pass so it always says "Gone" even with the app closed (simulator test 2026-11-10: staling at
// the rise left "In the sky 0:00" up for as long as the phone stayed locked). With the app closed the rise is therefore
// shown by the countdown reaching 0:00 and the bar starting to fill; with it open, the app sends "up" and "over" itself.
// The attributes type must have this exact name and shape in the app target too (PassActivityAttributes there).
struct PassActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable { var phase: String; var next: String? } // soon | up | over
    var pass: Pass
}
struct PassNow {
    let pass: Pass, up: Bool, over: Bool, next: String?
    init(_ ctx: ActivityViewContext<PassActivityAttributes>) {
        pass = ctx.attributes.pass; next = ctx.state.next
        let ph = ctx.state.phase
        over = ph == "over" || ctx.isStale || Date() >= pass.endDate
        up = !over && (ph == "up" || Date() >= pass.startDate)
    }
    // Ticks without the app: down to the rise, then down to the end of the pass.
    @ViewBuilder var timer: some View {
        if up { Text(timerInterval: pass.startDate...max(pass.endDate, pass.startDate.addingTimeInterval(1)), countsDown: true) }
        else { Text(timerInterval: min(Date(), pass.startDate.addingTimeInterval(-1))...pass.startDate, countsDown: true) }
    }
    var kicker: String { over ? "Gone" : up ? "Due now" : "Due in" }
    var line: String { over ? (next ?? "It's been by") : up ? "Look up" : pass.short }
}
// The pass as a bar that fills by itself, with how long it has left beside it. Before the rise that number is the
// length of the pass; from the rise it counts down. It's what tells you the pass is under way when the app is in the
// background and can't say so (Dynamic Island test 2026-11-10: the island read "Rises in 0:00" all through the pass).
struct PassBar: View {
    let n: PassNow
    var body: some View {
        let range = n.pass.startDate...max(n.pass.endDate, n.pass.startDate.addingTimeInterval(1))
        HStack(spacing: 8) {
            ProgressView(timerInterval: range, countsDown: false, label: { EmptyView() }, currentValueLabel: { EmptyView() })
                .progressViewStyle(.linear).tint(Color.ring)
            if !n.up {
                HStack(spacing: 3) {
                    Text("DUE FOR").font(.label(10)).tracking(1.2).foregroundStyle(Color.muted)
                    Text(timerInterval: range, countsDown: true).font(.label(13)).monospacedDigit().foregroundStyle(Color.cream).frame(width: 30, alignment: .trailing)
                }.fixedSize()
            }
        }
    }
}
struct PassLockView: View {
    let n: PassNow
    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 12) {
                RingArt(pass: n.pass, size: 56, full: n.up || n.over)
                VStack(alignment: .leading, spacing: 2) {
                    TierLine(pass: n.pass, size: 11)
                    Text(n.pass.name).font(.display(18)).foregroundStyle(Color.ink).lineLimit(1).minimumScaleFactor(0.7)
                    Text(n.line).font(.label(15)).foregroundStyle(Color.cream.opacity(0.9)).lineLimit(1).minimumScaleFactor(0.8)
                }
                Spacer(minLength: 4)
                VStack(alignment: .trailing, spacing: 1) {
                    Lab(text: n.kicker, color: n.over ? .muted : .orange)
                    if n.over { timeText(n.pass.endDate).font(.display(20)).foregroundStyle(Color.muted) }
                    else { n.timer.font(.display(26)).monospacedDigit().foregroundStyle(Color.ink).multilineTextAlignment(.trailing).frame(maxWidth: 86, alignment: .trailing) }
                }.padding(.trailing, 4)
            }
            if !n.over { PassBar(n: n) }
        }
        .padding(.horizontal, 16).padding(.vertical, 14)
        .accessibilityElement(children: .combine)
    }
}
struct PassActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PassActivityAttributes.self) { ctx in
            PassLockView(n: PassNow(ctx))
                .activityBackgroundTint(Color.navy.opacity(0.92))
                .activitySystemActionForegroundColor(Color.ink)
                .widgetURL(ctx.attributes.pass.url)
        } dynamicIsland: { ctx in
            let n = PassNow(ctx)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { RingArt(pass: n.pass, size: 46, full: n.up || n.over).padding(.leading, 4) }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 0) {
                        Lab(text: n.kicker, color: n.over ? .muted : .orange, size: 10)
                        if n.over { timeText(n.pass.endDate).font(.display(16)).foregroundStyle(Color.muted) }
                        else { n.timer.font(.display(20)).monospacedDigit().foregroundStyle(Color.ink).multilineTextAlignment(.trailing).frame(maxWidth: 70, alignment: .trailing) }
                    }.padding(.trailing, 12).padding(.top, 2) /* clear of the island's corner curve (Sevaan, 2026-11-10: the N looked cut off) */
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 1) { TierLine(pass: n.pass, size: 10); Text(n.pass.name).font(.display(15)).foregroundStyle(Color.ink).lineLimit(1).minimumScaleFactor(0.7) }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 6) {
                        Text(n.line).font(.label(15)).foregroundStyle(Color.cream.opacity(0.9)).lineLimit(1).minimumScaleFactor(0.8)
                        if !n.over { PassBar(n: n) }
                    }.padding(.horizontal, 6)
                }
            } compactLeading: {
                Text(Tier.gem(n.pass.tier)).font(.system(size: 14, weight: .bold)).foregroundStyle(Tier.color(n.pass.tier))
            } compactTrailing: {
                if n.over { Text("Gone").font(.label(13)).foregroundStyle(Color.muted) }
                else { n.timer.font(.label(15)).monospacedDigit().foregroundStyle(n.up ? Color.orange : Color.ink).frame(maxWidth: 44) }
            } minimal: {
                Text(Tier.gem(n.pass.tier)).font(.system(size: 13, weight: .bold)).foregroundStyle(Tier.color(n.pass.tier))
            }
            .widgetURL(n.pass.url)
            .keylineTint(Tier.color(n.pass.tier))
        }
    }
}

@main
struct SCBundle: WidgetBundle {
    var body: some Widget { SCWidget(); StreakWidget(); PassActivity() }
}

struct SCWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "SkyCollectorNext", provider: Provider()) { SCWidgetView(entry: $0) }
            .configurationDisplayName("Sky Collector")
            .description("Your next regular flight over you, and when it's due.")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryCircular, .accessoryRectangular, .accessoryInline])
            .contentMarginsDisabled()
    }
}

// Sky: your streak on the Lock Screen (2026-11-19, the approved widget spec): weeks in a row with a catch, from the
// app's own streak (js/progress.js streaks; cloudy weeks don't break it). Plus, like the other lock screen widgets.
struct StreakView: View {
    @Environment(\.widgetFamily) var family
    let plan: Plan?
    var body: some View {
        let s = plan?.streak, w = s?.weeks ?? 0
        if plan != nil && plan?.plus != true {
            if family == .accessoryInline { Text("Sky Collector Plus") } else { ZStack { AccessoryWidgetBackground(); Text("PLUS").font(.system(size: 12, weight: .bold)) } }
        } else if family == .accessoryInline {
            Text(w >= 1 ? "🔥 \(w)-week streak\(s?.thisWeek == false ? " · look up this week" : "")" : "🔥 Start a streak this week")
        } else {
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: -1) {
                    Image(systemName: s?.thisWeek == false ? "flame" : "flame.fill").font(.system(size: 11, weight: .semibold))
                    Text("\(w)").font(.system(size: 19, weight: .bold)).monospacedDigit()
                    Text(w == 1 ? "WEEK" : "WEEKS").font(.system(size: 7, weight: .semibold))
                }
            }
        }
    }
}
struct StreakWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "SkyCollectorStreak", provider: Provider()) { StreakView(plan: $0.plan) }
            .configurationDisplayName("Sky Collector streak")
            .description("Weeks in a row you've caught a plane.")
            .supportedFamilies([.accessoryCircular, .accessoryInline])
    }
}

// A sample day for the widget gallery, before the app has learned any regulars (Sky: airline flights only).
enum Sample {
    static var plan: Plan {
        let now = Date().timeIntervalSince1970 * 1000, min = 60_000.0
        func pass(_ k: String, _ n: String, _ tag: String, _ t: String, _ s: Double, _ to: String, fresh: Bool = false) -> Pass {
            Pass(key: k, name: n, tier: t, icon: false, art: nil, start: now + s * min, end: now + (s + 8) * min, where: "to \(to)", short: "To \(to)", kick: "next", cloud: false, tag: tag, fresh: fresh)
        }
        let all = [pass("ACA856@1", "Air Canada 856", "ACA856", "uncommon", 12, "London", fresh: true), pass("WJA1234@2", "WestJet 1234", "WJA1234", "common", 34, "Calgary"),
                   pass("DLH471@3", "Lufthansa 471", "DLH471", "rare", 58, "Munich", fresh: true), pass("UAE242@4", "Emirates 242", "UAE242", "epic", 95, "Dubai")]
        let bars: [Double] = [0, 0, 0, 0, 0, 2, 6, 11, 14, 12, 10, 9, 11, 13, 12, 10, 12, 15, 17, 13, 9, 6, 3, 1]
        return Plan(at: now, place: "", plus: true, dusk: nil, dawn: now + 1440 * min, eve: now + 1440 * min,
                    chain: [Step(from: now, pass: all[0])], list: all, run: all, back: nil,
                    haul: Haul(n: 2, top: "rare", topN: 1), bars: bars, wx: nil, missions: 2, clock: nil,
                    streak: Streak(weeks: 3, thisWeek: true), dark: nil)
    }
}
