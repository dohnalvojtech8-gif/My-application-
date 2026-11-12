import WidgetKit
import SwiftUI
import AppIntents
struct WidgetActionEntity: AppEntity {
 static var typeDisplayRepresentation: TypeDisplayRepresentation = "Rychlá akce"
 static var defaultQuery = WidgetActionQuery()
 var id: String;var name:String
 var displayRepresentation:DisplayRepresentation {DisplayRepresentation(title:"\(name)")}
}
struct WidgetActionQuery: EntityQuery {
 func entities(for identifiers:[String]) async throws -> [WidgetActionEntity] {try await suggestedEntities().filter{identifiers.contains($0.id)}}
 func suggestedEntities() async throws -> [WidgetActionEntity] {try await WidgetStore.snapshot().actions.map{WidgetActionEntity(id:$0.id,name:$0.name+" · "+WidgetStore.money($0.amount,currency:$0.currency))}}
}
struct MoneyConfiguration: WidgetConfigurationIntent {
 static var title:LocalizedStringResource = "Nastavení financí"
 static var description = IntentDescription("Vyberte uloženou položku, částku a zobrazení zůstatku.")
 @Parameter(title:"Rychlá akce") var action:WidgetActionEntity?
 @Parameter(title:"Zobrazit zůstatek",default:false) var showBalance:Bool
}
struct SavePaymentIntent: AppIntent {
 static var title:LocalizedStringResource = "Uložit přednastavenou platbu"
 static var authenticationPolicy:IntentAuthenticationPolicy = .requiresLocalDeviceAuthentication
 @Parameter(title:"Akce") var actionId:String
 @Parameter(title:"Identifikátor požadavku") var requestId:String
 init(){}
 init(actionId:String,requestId:String){self.actionId=actionId;self.requestId=requestId}
 func perform() async throws -> some IntentResult {WidgetStore.defaults.set(true,forKey:"pending."+actionId);do{_ = try await WidgetStore.request("/actions/"+actionId,body:["requestId":requestId]);WidgetStore.defaults.removeObject(forKey:"pending."+actionId);if WidgetStore.nonce(actionId)==requestId { WidgetStore.renew(actionId) };WidgetStore.defaults.set("Uloženo",forKey:"message."+actionId);WidgetCenter.shared.reloadAllTimelines();return .result()}catch{WidgetStore.defaults.set("Výsledek neověřený · opakujte stejnou akci",forKey:"message."+actionId);WidgetCenter.shared.reloadAllTimelines();throw error}}
}
struct RefreshMoneyIntent:AppIntent {
 static var title:LocalizedStringResource = "Obnovit widget"
 static var authenticationPolicy:IntentAuthenticationPolicy = .requiresLocalDeviceAuthentication
 @Parameter(title:"Akce") var actionId:String
 init(){}
 init(actionId:String){self.actionId=actionId}
 func perform() async throws -> some IntentResult {WidgetStore.renew(actionId);WidgetCenter.shared.reloadAllTimelines();return .result()}
}
struct MoneyEntry:TimelineEntry {let date:Date;let action:QuickPreset?;let balance:String?;let showBalance:Bool;let nonce:String;let message:String}
struct MoneyProvider:AppIntentTimelineProvider {
 func placeholder(in context:Context)->MoneyEntry{MoneyEntry(date:.now,action:nil,balance:nil,showBalance:false,nonce:UUID().uuidString,message:"SYSTEMATIC MONEY")}
 func snapshot(for configuration:MoneyConfiguration,in context:Context) async -> MoneyEntry {await entry(configuration)}
 func timeline(for configuration:MoneyConfiguration,in context:Context) async -> Timeline<MoneyEntry> {Timeline(entries:[await entry(configuration)],policy:.after(Date().addingTimeInterval(1800)))}
 private func entry(_ config:MoneyConfiguration) async -> MoneyEntry {do{let snapshot=try await WidgetStore.snapshot();let action=config.action==nil ? snapshot.actions.first : snapshot.actions.first{$0.id==config.action?.id};let id=action?.id ?? "none";return MoneyEntry(date:.now,action:action,balance:snapshot.balance,showBalance:config.showBalance,nonce:WidgetStore.nonce(id),message:WidgetStore.defaults.string(forKey:"message."+id) ?? "Aktualizováno")}catch{return MoneyEntry(date:.now,action:nil,balance:nil,showBalance:false,nonce:UUID().uuidString,message:"Připojte widget v aplikaci")}}
}
struct MoneyView:View {
 let entry:MoneyEntry
 @Environment(\.widgetFamily) var family
 var accessory:Bool {family == .accessoryCircular || family == .accessoryRectangular}
 var body:some View {VStack(alignment:.leading,spacing:9){if !accessory {HStack{Label("SYSTEMATIC MONEY",systemImage:"wallet.pass").font(.system(size:10,weight:.bold));Spacer();if let action=entry.action {Button(intent:RefreshMoneyIntent(actionId:action.id)){Image(systemName:"arrow.clockwise")}.buttonStyle(.plain).accessibilityLabel("Obnovit a připravit další platbu")}}}
 if entry.showBalance,let balance=entry.balance {Text(WidgetStore.money(balance)).font(accessory ? .caption : .title3).bold().privacySensitive()}
 if let action=entry.action {if action.mode=="DIRECT" {Button(intent:SavePaymentIntent(actionId:action.id,requestId:entry.nonce)){Label(action.name+" · "+WidgetStore.money(action.amount,currency:action.currency),systemImage:action.kind=="INCOME" ? "plus.circle.fill":"minus.circle.fill").font(.caption).lineLimit(2)}.buttonStyle(.bordered).tint(.mint)}else{Link(destination:URL(string:"systematicmoney://quick?action="+action.id)!){Label(accessory && family == .accessoryCircular ? "" : action.name,systemImage:action.kind=="INCOME" ? "plus.circle.fill":"minus.circle.fill").font(.caption)}}}else{Link(destination:URL(string:"systematicmoney://quick")!){Label("Otevřít aplikaci",systemImage:"wallet.pass")}}
 if !accessory{Text(entry.message).font(.system(size:9)).foregroundStyle(.secondary);Text(entry.date,style:.time).font(.system(size:9)).foregroundStyle(.secondary)}
 }.containerBackground(Color(red:0.02,green:0.21,blue:0.30),for:.widget).foregroundStyle(.mint)}
}
struct MoneyWidget:Widget {
 let kind="MoneyWidget"
 var body:some WidgetConfiguration {AppIntentConfiguration(kind:kind,intent:MoneyConfiguration.self,provider:MoneyProvider()){MoneyView(entry:$0)}.configurationDisplayName("SYSTEMATIC MONEY").description("Zůstatek a vaše rychlé příjmy i výdaje. Přímé uložení vyžaduje odemknutí.").supportedFamilies([.systemSmall,.systemMedium,.accessoryCircular,.accessoryRectangular])}
}

// Simple lock-screen launchers need no widget token and never book a payment.
struct LauncherEntry: TimelineEntry { let date: Date }
struct LauncherProvider: TimelineProvider {
    func placeholder(in context: Context) -> LauncherEntry { LauncherEntry(date: .now) }
    func getSnapshot(in context: Context, completion: @escaping (LauncherEntry) -> Void) { completion(placeholder(in: context)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<LauncherEntry>) -> Void) {
        completion(Timeline(entries: [placeholder(in: context)], policy: .never))
    }
}
struct LauncherView: View {
    let income: Bool
    @Environment(\.widgetFamily) var family
    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: income ? "plus.circle.fill" : "minus.circle.fill").font(family == .accessoryCircular ? .title2 : .largeTitle)
            if family != .accessoryCircular { Text(income ? "Příjem" : "Výdaj").font(.headline) }
        }
        .containerBackground(Color(red: 0.02, green: 0.21, blue: 0.30), for: .widget)
        .foregroundStyle(income ? Color.mint : Color.pink)
        .widgetURL(URL(string: "systematicmoney://quick?kind=" + (income ? "INCOME" : "EXPENSE")))
        .accessibilityLabel(income ? "Otevřít příjmový list" : "Otevřít výdajový list")
    }
}
struct IncomeLauncherWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "IncomeLauncher", provider: LauncherProvider()) { _ in LauncherView(income: true) }
            .configurationDisplayName("Příjem").description("Otevře příjmový list. Platbu uložíte až ve formuláři.")
            .supportedFamilies([.accessoryCircular, .accessoryRectangular, .systemSmall])
    }
}
struct ExpenseLauncherWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ExpenseLauncher", provider: LauncherProvider()) { _ in LauncherView(income: false) }
            .configurationDisplayName("Výdaj").description("Otevře výdajový list. Platbu uložíte až ve formuláři.")
            .supportedFamilies([.accessoryCircular, .accessoryRectangular, .systemSmall])
    }
}
struct PanelEntry: TimelineEntry {
    let date: Date
    let panel: WidgetPanel?
    let nonces: [String: String]
}
struct PanelProvider: TimelineProvider {
    func placeholder(in context: Context) -> PanelEntry { PanelEntry(date: .now, panel: nil, nonces: [:]) }
    func getSnapshot(in context: Context, completion: @escaping (PanelEntry) -> Void) {
        Task { completion(await load()) }
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<PanelEntry>) -> Void) {
        Task { completion(Timeline(entries: [await load()], policy: .after(Date().addingTimeInterval(1800)))) }
    }
    private func load() async -> PanelEntry {
        let panel = try? await WidgetStore.snapshot().panel
        var nonces: [String: String] = [:]
        for action in (panel?.incomes ?? []) + (panel?.expenses ?? []) {
            if let action { nonces[action.id] = WidgetStore.nonce(action.id) }
        }
        return PanelEntry(date: .now, panel: panel, nonces: nonces)
    }
}
struct PanelView: View {
    let entry: PanelEntry
    @Environment(\.widgetFamily) var family
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("SYSTEMATIC MONEY · 5 + 5").font(.system(size: 10, weight: .bold))
            if let panel = entry.panel {
                if panel.incomeFirst { row(panel.incomes, income: true); row(panel.expenses, income: false) }
                else { row(panel.expenses, income: false); row(panel.incomes, income: true) }
            } else {
                Text("Připojte widgety a nastavte panel v aplikaci.").font(.caption)
                Link("Otevřít aplikaci", destination: URL(string: "systematicmoney://quick")!)
            }
        }
        .containerBackground(Color(red: 0.02, green: 0.21, blue: 0.30), for: .widget)
        .foregroundStyle(.mint)
    }
    private func row(_ actions: [QuickPreset?], income: Bool) -> some View {
        HStack(spacing: 4) {
            ForEach(0..<5, id: \.self) { index in
                if index < actions.count, let action = actions[index], let nonce = entry.nonces[action.id] {
                    Button(intent: SavePaymentIntent(actionId: action.id, requestId: nonce)) {
                        VStack(spacing: 2) {
                            Image(systemName: income ? "plus.circle.fill" : "minus.circle.fill")
                            Text(action.name).lineLimit(1)
                            Text(WidgetStore.money(action.amount,currency:action.currency)).lineLimit(1).minimumScaleFactor(0.6)
                        }.font(.system(size: family == .systemLarge ? 12 : 10))
                            .frame(maxWidth: .infinity, minHeight: family == .systemLarge ? 96 : 42)
                    }
                    .buttonStyle(.plain).tint(income ? .mint : .pink)
                    .foregroundStyle(income ? Color.mint : Color.pink)
                    .accessibilityLabel("\(income ? "Příjem" : "Výdaj") \(action.name), \(WidgetStore.money(action.amount,currency:action.currency))")
                } else {
                    Text(income ? "+" : "−").frame(maxWidth: .infinity, minHeight: 42).opacity(0.25)
                }
            }
        }
    }
}
struct MoneyPanelWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MoneyPanel", provider: PanelProvider()) { PanelView(entry: $0) }
            .configurationDisplayName("5 výdajů + 5 příjmů")
            .description("Deset předvolených plateb. Pozice a pořadí řádků nastavíte v aplikaci. Přímé akce vyžadují odemčení zařízení.")
            .supportedFamilies([.systemMedium, .systemLarge])
    }
}
@main struct MoneyWidgets: WidgetBundle {
    var body: some Widget {
        IncomeLauncherWidget()
        ExpenseLauncherWidget()
        MoneyWidget()
        MoneyPanelWidget()
    }
}
