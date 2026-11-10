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
 func suggestedEntities() async throws -> [WidgetActionEntity] {try await WidgetStore.snapshot().actions.map{WidgetActionEntity(id:$0.id,name:$0.name+" · "+WidgetStore.money($0.amount))}}
}
struct MoneyConfiguration: WidgetConfigurationIntent {
 static var title:LocalizedStringResource = "Nastavení financí"
 static var description = IntentDescription("Vyberte uloženou položku, částku a zobrazení zůstatku.")
 @Parameter(title:"Rychlá akce") var action:WidgetActionEntity?
 @Parameter(title:"Zobrazit zůstatek",default:false) var showBalance:Bool
}
struct SavePaymentIntent: AppIntent {
 static var title:LocalizedStringResource = "Uložit přednastavenou platbu"
 static var authenticationPolicy:IntentAuthenticationPolicy = .requiresAuthentication
 @Parameter(title:"Akce") var actionId:String
 @Parameter(title:"Identifikátor požadavku") var requestId:String
 init(){}
 init(actionId:String,requestId:String){self.actionId=actionId;self.requestId=requestId}
 func perform() async throws -> some IntentResult {WidgetStore.defaults.set(true,forKey:"pending."+actionId);do{_ = try await WidgetStore.request("/actions/"+actionId,body:["requestId":requestId]);WidgetStore.defaults.removeObject(forKey:"pending."+actionId);WidgetStore.defaults.set("Uloženo · obnovte pro další platbu",forKey:"message."+actionId);WidgetCenter.shared.reloadAllTimelines();return .result()}catch{WidgetStore.defaults.set("Výsledek neověřený · opakujte stejnou akci",forKey:"message."+actionId);WidgetCenter.shared.reloadAllTimelines();throw error}}
}
struct RefreshMoneyIntent:AppIntent {
 static var title:LocalizedStringResource = "Obnovit widget"
 static var authenticationPolicy:IntentAuthenticationPolicy = .requiresAuthentication
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
 if let action=entry.action {if action.mode=="DIRECT" && !accessory {Button(intent:SavePaymentIntent(actionId:action.id,requestId:entry.nonce)){Label(action.name+" · "+WidgetStore.money(action.amount),systemImage:action.kind=="INCOME" ? "plus.circle.fill":"minus.circle.fill").font(.caption).lineLimit(2)}.buttonStyle(.bordered).tint(.mint)}else{Link(destination:URL(string:"systematicmoney://quick?action="+action.id)!){Label(accessory && family == .accessoryCircular ? "" : action.name,systemImage:action.kind=="INCOME" ? "plus.circle.fill":"minus.circle.fill").font(.caption)}}}else{Link(destination:URL(string:"systematicmoney://quick")!){Label("Otevřít aplikaci",systemImage:"wallet.pass")}}
 if !accessory{Text(entry.message).font(.system(size:9)).foregroundStyle(.secondary);Text(entry.date,style:.time).font(.system(size:9)).foregroundStyle(.secondary)}
 }.containerBackground(Color(red:0.02,green:0.21,blue:0.30),for:.widget).foregroundStyle(.mint)}
}
@main struct MoneyWidget:Widget {
 let kind="MoneyWidget"
 var body:some WidgetConfiguration {AppIntentConfiguration(kind:kind,intent:MoneyConfiguration.self,provider:MoneyProvider()){MoneyView(entry:$0)}.configurationDisplayName("SYSTEMATIC MONEY").description("Zůstatek a vaše rychlé příjmy i výdaje. Přímé uložení vyžaduje odemknutí.").supportedFamilies([.systemSmall,.systemMedium,.accessoryCircular,.accessoryRectangular])}
}
