package cz.systematic.money;

import android.app.*;
import android.content.*;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.*;
import org.json.JSONObject;
import java.util.UUID;

/** Only an immutable widget PendingIntent may start this non-exported activity. */
public class WidgetAuthActivity extends Activity {
    private static final int VERIFY_DEVICE = 43;
    private TextView status;
    private String actionId, requestId;
    private boolean saving;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        status=new TextView(this);status.setPadding(32,64,32,32);status.setTextSize(20);setContentView(status);
        try {
            actionId=UUID.fromString(getIntent().getStringExtra("actionId")).toString();
            requestId=UUID.fromString(getIntent().getStringExtra("requestId")).toString();
        } catch(Exception e){finish();return;}
        status.setText("Ověřte zámek telefonu pro uložení platby.");
        if(state==null) {
            KeyguardManager manager=(KeyguardManager)getSystemService(KEYGUARD_SERVICE);
            if(!manager.isDeviceSecure()){status.setText("Nejdříve nastavte PIN nebo heslo v zabezpečení telefonu. Platba nebyla uložena.");return;}
            Intent challenge=manager.createConfirmDeviceCredentialIntent("Uložit platbu",getIntent().getStringExtra("label"));
            if(challenge==null){status.setText("Ověření telefonu není dostupné. Platba nebyla uložena.");return;}
            startActivityForResult(challenge,VERIFY_DEVICE);
        }
    }
    @Override protected void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data);
        if(request!=VERIFY_DEVICE)return;
        if(result!=RESULT_OK){finish();return;}
        if(saving)return;
        saving=true;status.setText("Ukládám platbu…");
        // No network write is reachable before the system returns RESULT_OK.
        MoneyWidget.executor.execute(() -> {
            try {
                JSONObject response=WidgetAPI.request(this,"/actions/"+actionId,new JSONObject().put("requestId",requestId));
                if(!response.optBoolean("ok"))throw new Exception("Invalid response");
                MoneyWidget.saved(this,actionId,requestId);
                MoneyWidget.refreshAll(this);
                runOnUiThread(() -> {Toast.makeText(this,"Platba uložena",Toast.LENGTH_LONG).show();finish();});
            } catch(Exception e) {
                // Retain the same request ID: retry from the widget cannot double-charge.
                runOnUiThread(() -> status.setText("Výsledek platby nelze ověřit. Vraťte se k widgetu a opakujte stejnou akci; nezaloží duplicitní platbu."));
            }
        });
    }
}
