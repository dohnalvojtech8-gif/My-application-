import Foundation
import Capacitor
import WidgetKit
@objc(MoneyWidgetsPlugin)
public class MoneyWidgetsPlugin: CAPPlugin, CAPBridgedPlugin {
 public let identifier = "MoneyWidgetsPlugin"
 public let jsName = "MoneyWidgets"
 public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name:"connect",returnType:CAPPluginReturnPromise),CAPPluginMethod(name:"disconnect",returnType:CAPPluginReturnPromise),CAPPluginMethod(name:"status",returnType:CAPPluginReturnPromise),CAPPluginMethod(name:"refresh",returnType:CAPPluginReturnPromise)]
 @objc func connect(_ call:CAPPluginCall){DispatchQueue.main.async{guard let origin=call.getString("origin"),let token=call.getString("token"),let id=call.getString("deviceId"),let target=URL(string:origin),let current=self.bridge?.webView?.url,target.scheme=="https",target.host==current.host,target.port==current.port,current.scheme=="https",target.path.isEmpty||target.path=="/",token.range(of:"^[a-f0-9]{64}$",options:.regularExpression) != nil else{call.reject("Neplatný server widgetu");return};do{try WidgetStore.save(WidgetCredentials(origin:origin,token:token,deviceId:id));WidgetCenter.shared.reloadAllTimelines();call.resolve()}catch{call.reject("Nelze uložit oprávnění do Keychain. Ověřte podpis a sdílenou Keychain group.")}}}
 @objc func disconnect(_ call:CAPPluginCall){WidgetStore.clear();WidgetCenter.shared.reloadAllTimelines();call.resolve()}
 @objc func status(_ call:CAPPluginCall){if let c=try? WidgetStore.read(){call.resolve(["connected":true,"deviceId":c.deviceId])}else{call.resolve(["connected":false])}}
 @objc func refresh(_ call:CAPPluginCall){WidgetCenter.shared.reloadAllTimelines();call.resolve()}
}
class MoneyBridgeViewController: CAPBridgeViewController {
 override func capacitorDidLoad(){bridge?.registerPluginInstance(MoneyWidgetsPlugin())}
}
