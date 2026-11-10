package cz.systematic.money;
import com.getcapacitor.*;import com.getcapacitor.annotation.CapacitorPlugin;import java.net.URI;import org.json.JSONObject;
@CapacitorPlugin(name="MoneyWidgets")
public class MoneyWidgetsPlugin extends Plugin {
 @PluginMethod public void connect(PluginCall call){try{String origin=call.getString("origin"),token=call.getString("token"),deviceId=call.getString("deviceId");URI target=URI.create(origin),current=URI.create(getBridge().getWebView().getUrl());if(!"https".equals(target.getScheme())||!target.getAuthority().equals(current.getAuthority())||!target.getScheme().equals(current.getScheme())||target.getRawPath()!=null&&!target.getRawPath().isEmpty()||!token.matches("[a-f0-9]{64}"))throw new Exception("Neplatný server widgetu");JSONObject creds=new JSONObject().put("origin",origin).put("token",token).put("deviceId",deviceId);WidgetStore.save(getContext(),creds);MoneyWidget.refreshAll(getContext());call.resolve();}catch(Exception e){call.reject("Widget nelze bezpečně připojit");}}
 @PluginMethod public void disconnect(PluginCall call){WidgetStore.clear(getContext());MoneyWidget.refreshAll(getContext());call.resolve();}
 @PluginMethod public void status(PluginCall call){JSObject result=new JSObject();try{result.put("deviceId",WidgetStore.read(getContext()).getString("deviceId"));result.put("connected",true);}catch(Exception e){result.put("connected",false);}call.resolve(result);}
 @PluginMethod public void refresh(PluginCall call){MoneyWidget.refreshAll(getContext());call.resolve();}
}
