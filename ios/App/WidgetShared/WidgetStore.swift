import Foundation
import Security
struct WidgetCredentials: Codable { let origin: String; let token: String; let deviceId: String }
struct QuickPreset: Codable, Identifiable { let id: String; let name: String; let itemId: String; let kind: String; let amount: String; let mode: String; let showBalance: Bool; let color: String }
struct WidgetSnapshot: Codable { let balance: String?; let actions: [QuickPreset]; let updatedAt: String }
enum WidgetFailure: Error, LocalizedError { case disconnected, invalidServer, requestFailed
 var errorDescription: String? { switch self { case .disconnected:return "Připojte widgety v aplikaci.";case .invalidServer:return "Neplatná adresa serveru.";case .requestFailed:return "Platbu nelze potvrdit. Obnovte připojení a zkuste stejnou akci znovu." } }
}
final class NoWidgetRedirects: NSObject, URLSessionTaskDelegate {
 func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
enum WidgetStore {
 static let defaults = UserDefaults(suiteName: "group.cz.systematic.money")!
 static var query: [String:Any] { [kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:"systematic-money-widget",kSecAttrAccount as String:"device",kSecAttrAccessGroup as String:Bundle.main.object(forInfoDictionaryKey:"WidgetKeychainGroup") as? String ?? ""] }
 static func save(_ credentials: WidgetCredentials) throws { clear(); var q=query;q[kSecValueData as String]=try JSONEncoder().encode(credentials);q[kSecAttrAccessible as String]=kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly;guard SecItemAdd(q as CFDictionary,nil)==errSecSuccess else {throw WidgetFailure.disconnected} }
 static func read() throws -> WidgetCredentials { var q=query;q[kSecReturnData as String]=true;q[kSecMatchLimit as String]=kSecMatchLimitOne;var value:CFTypeRef?;guard SecItemCopyMatching(q as CFDictionary,&value)==errSecSuccess,let data=value as? Data else{throw WidgetFailure.disconnected};return try JSONDecoder().decode(WidgetCredentials.self,from:data) }
 static func clear() {SecItemDelete(query as CFDictionary);defaults.removePersistentDomain(forName:"group.cz.systematic.money")}
 static func nonce(_ action:String)->String {let key="nonce."+action;if let value=defaults.string(forKey:key){return value};let value=UUID().uuidString;defaults.set(value,forKey:key);return value}
 static func renew(_ action:String){guard !defaults.bool(forKey:"pending."+action) else { return };defaults.set(UUID().uuidString,forKey:"nonce."+action);defaults.removeObject(forKey:"message."+action)}
 static func request(_ path:String,body:[String:String]?=nil) async throws -> Data {let credentials=try read();guard let url=URL(string:credentials.origin+"/api/widget"+path),url.scheme=="https" else{throw WidgetFailure.invalidServer};var req=URLRequest(url:url);req.timeoutInterval=15;req.setValue("Bearer "+credentials.token,forHTTPHeaderField:"Authorization");if let body=body{req.httpMethod="POST";req.setValue("application/json",forHTTPHeaderField:"Content-Type");req.httpBody=try JSONEncoder().encode(body)};let session=URLSession(configuration:.ephemeral,delegate:NoWidgetRedirects(),delegateQueue:nil);defer{session.finishTasksAndInvalidate()};let(data,response)=try await session.data(for:req);guard let response=response as? HTTPURLResponse else{throw WidgetFailure.requestFailed};if response.statusCode==401{clear();throw WidgetFailure.disconnected};guard (200..<300).contains(response.statusCode) else{throw WidgetFailure.requestFailed};return data }
 static func snapshot() async throws -> WidgetSnapshot {let data=try await request("/snapshot");return try JSONDecoder().decode(WidgetSnapshot.self,from:data)}
 static func money(_ value:String)->String {guard let number=Decimal(string:value) else{return "••••"};let formatter=NumberFormatter();formatter.numberStyle = .currency;formatter.currencyCode="CZK";formatter.locale=Locale(identifier:"cs_CZ");return formatter.string(from:NSDecimalNumber(decimal:number/100)) ?? "••••"}
}
