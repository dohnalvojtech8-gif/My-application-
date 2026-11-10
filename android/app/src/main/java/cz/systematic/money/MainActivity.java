package cz.systematic.money;
import android.os.Bundle;import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
 @Override public void onCreate(Bundle state){registerPlugin(MoneyWidgetsPlugin.class);super.onCreate(state);}
}
