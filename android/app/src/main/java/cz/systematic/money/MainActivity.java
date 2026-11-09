package cz.systematic.money;
import android.os.Bundle;
import android.content.Intent;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
 @Override public void onCreate(Bundle state){super.onCreate(state);handleQuick(getIntent());}
 @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);handleQuick(intent);}
 private void handleQuick(Intent intent){if(intent.getBooleanExtra("quickExpense",false)&&bridge!=null){String url=bridge.getWebView().getUrl();if(url!=null)bridge.getWebView().loadUrl(url.split("\\?")[0]+"?quick=EXPENSE");}}
}
