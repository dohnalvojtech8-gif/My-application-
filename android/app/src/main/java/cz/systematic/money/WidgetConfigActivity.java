package cz.systematic.money;
import android.app.*;import android.appwidget.*;import android.content.*;import android.os.Bundle;import android.widget.*;import org.json.*;
public class WidgetConfigActivity extends Activity {
    private int widgetId;
    private LinearLayout layout;
    private void option(String title,String mode,String action){
        Button button=new Button(this);button.setText(title);layout.addView(button);
        button.setOnClickListener(v->{WidgetStore.prefs(this).edit().putString("mode_"+widgetId,mode).putString("action_"+widgetId,action).commit();MoneyWidget.executor.execute(()->MoneyWidget.update(this,widgetId,false));setResult(RESULT_OK,new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,widgetId));finish();});
    }
    @Override public void onCreate(Bundle state){
        super.onCreate(state);setResult(RESULT_CANCELED);
        widgetId=getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,-1);if(widgetId<0){finish();return;}
        layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);layout.setPadding(24,40,24,24);
        TextView title=new TextView(this);title.setText("SYSTEMATIC MONEY · Typ widgetu");title.setTextSize(21);layout.addView(title);
        ScrollView scroll=new ScrollView(this);scroll.addView(layout);setContentView(scroll);
        option("+ Příjem · otevřít příjmový list","INCOME","");
        option("− Výdaj · otevřít výdajový list","EXPENSE","");
        option("Panel 5 výdajů + 5 příjmů","PANEL","");
        MoneyWidget.executor.execute(()->{try{
            JSONArray actions=WidgetAPI.request(this,"/snapshot",null).getJSONArray("actions");
            runOnUiThread(()->{for(int n=0;n<actions.length();n++){JSONObject a=actions.optJSONObject(n);option(a.optString("name")+" · "+MoneyWidget.money(a.optString("amount"))+" · "+(a.optString("mode").equals("DIRECT")?"ověřit a uložit":"formulář"),"SINGLE",a.optString("id"));}});
        }catch(Exception e){runOnUiThread(()->{TextView note=new TextView(this);note.setText("Pro přednastavené platby připojte widgety v Nastavení aplikace. Jednoduchý Příjem a Výdaj připojení widgetu nepotřebují.");layout.addView(note);});}});
    }
}
