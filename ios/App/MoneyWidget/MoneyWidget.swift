import WidgetKit
import SwiftUI
import AppIntents
struct OpenExpenseIntent: AppIntent {
 static var title: LocalizedStringResource = "Rychlý výdaj"
 static var openAppWhenRun = true
 func perform() async throws -> some IntentResult & OpensIntent { .result(opensIntent: OpenURLIntent(URL(string: "systematicmoney://quick?kind=EXPENSE")!)) }
}
struct MoneyEntry: TimelineEntry { let date: Date }
struct MoneyProvider: TimelineProvider {
 func placeholder(in context: Context) -> MoneyEntry { MoneyEntry(date: .now) }
 func getSnapshot(in context: Context, completion: @escaping (MoneyEntry) -> Void) { completion(MoneyEntry(date: .now)) }
 func getTimeline(in context: Context, completion: @escaping (Timeline<MoneyEntry>) -> Void) { completion(Timeline(entries: [MoneyEntry(date: .now)], policy: .never)) }
}
struct MoneyView: View {
 let entry: MoneyEntry
 @Environment(\.widgetFamily) var family
 var body: some View {
  VStack(alignment: .leading) {
   if family != .accessoryCircular { Text("SYSTEMATIC MONEY").font(.caption).bold() }
   Link(destination: URL(string: "systematicmoney://quick?kind=EXPENSE")!) { Label("Rychlý výdaj", systemImage: "minus.circle.fill") }
  }.containerBackground(Color(red: 0, green: 0.22, blue: 0.31), for: .widget).foregroundStyle(.mint)
 }
}
@main struct MoneyWidget: Widget {
 let kind = "MoneyWidget"
 var body: some WidgetConfiguration { StaticConfiguration(kind: kind, provider: MoneyProvider()) { MoneyView(entry: $0) }.configurationDisplayName("SYSTEMATIC MONEY").description("Otevře zabezpečený formulář pro nový výdaj.").supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular]) }
}
