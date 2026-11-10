package cz.systematic.money;

import android.app.*;
import android.appwidget.*;
import android.content.*;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import org.json.*;
import java.util.*;
import java.util.concurrent.*;

public class MoneyWidget extends AppWidgetProvider {
    static final ExecutorService executor = Executors.newSingleThreadExecutor();
    static final String REFRESH = "cz.systematic.money.REFRESH_WIDGET";
    static final int[] SLOTS = {R.id.slot_0,R.id.slot_1,R.id.slot_2,R.id.slot_3,R.id.slot_4,R.id.slot_5,R.id.slot_6,R.id.slot_7,R.id.slot_8,R.id.slot_9};

    public static void refreshAll(Context c) {
        int[] ids = AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, MoneyWidget.class));
        for (int id : ids) executor.execute(() -> update(c,id,false));
    }
    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        PendingResult pending = goAsync();
        executor.execute(() -> { try { for (int id : ids) update(c,id,false); } finally { pending.finish(); } });
    }
    @Override public void onDeleted(Context c,int[] ids) {
        for (int id : ids) WidgetStore.prefs(c).edit().remove("action_"+id).remove("mode_"+id).apply();
    }
    @Override public void onReceive(Context c,Intent intent) {
        super.onReceive(c,intent);
        if (!REFRESH.equals(intent.getAction())) return;
        int id=intent.getIntExtra("widgetId",-1);
        if(id<0)return;
        PendingResult pending=goAsync();
        executor.execute(() -> { try { update(c,id,false); } finally { pending.finish(); } });
    }
    static String nonce(Context c,String action) {
        synchronized (MoneyWidget.class) {
            String value=WidgetStore.prefs(c).getString("nonce.action."+action,null);
            if(value==null){value=UUID.randomUUID().toString();WidgetStore.prefs(c).edit().putString("nonce.action."+action,value).commit();}
            return value;
        }
    }
    static void saved(Context c,String action,String request) {
        synchronized (MoneyWidget.class) {
            // Only rotate the currently displayed request; a replay must not rotate a newer one.
            if(request.equals(nonce(c,action))) WidgetStore.prefs(c).edit().putString("nonce.action."+action,UUID.randomUUID().toString()).commit();
        }
    }
    static void update(Context c,int id,boolean unused) {
        String mode=WidgetStore.prefs(c).getString("mode_"+id,"SINGLE");
        if(mode.equals("INCOME")||mode.equals("EXPENSE")){render(c,id,null,"Otevřít formulář");return;}
        try { render(c,id,WidgetAPI.request(c,"/snapshot",null),"Ověření telefonu před uložením"); }
        catch(Exception e){render(c,id,null,"Obnovte připojení v aplikaci");}
    }
    static String money(String cents) {
        try{return new java.math.BigDecimal(cents).movePointLeft(2).stripTrailingZeros().toPlainString()+" Kč";}catch(Exception e){return "••••";}
    }
    static PendingIntent form(Context c,String query) {
        Intent open=new Intent(c,MainActivity.class).setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse("systematicmoney://quick?"+query)).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c,0,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    static void bind(Context c,RemoteViews view,int viewId,JSONObject action) {
        if(action==null){view.setTextViewText(viewId,"—");view.setOnClickPendingIntent(viewId,null);return;}
        view.setTextViewText(viewId,(action.optString("kind").equals("INCOME")?"+ ":"− ")+action.optString("name")+"\n"+money(action.optString("amount")));
        view.setTextColor(viewId,android.graphics.Color.parseColor(action.optString("kind").equals("INCOME")?"#8DF2BB":"#FFB3C5"));
        if(!action.optString("mode").equals("DIRECT")) {view.setOnClickPendingIntent(viewId,form(c,"action="+action.optString("id")));return;}
        String actionId=action.optString("id"),request=nonce(c,actionId);
        Intent intent=new Intent(c,WidgetAuthActivity.class)
            .setData(Uri.parse("moneywidget://authenticate/"+actionId+"/"+request))
            .putExtra("actionId",actionId).putExtra("requestId",request)
            .putExtra("label",action.optString("name")+" · "+money(action.optString("amount")));
        view.setOnClickPendingIntent(viewId,PendingIntent.getActivity(c,0,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
    }
    static void render(Context c,int id,JSONObject snapshot,String message) {
        RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.money_widget);
        String mode=WidgetStore.prefs(c).getString("mode_"+id,"SINGLE");
        boolean panel=mode.equals("PANEL"),launcher=mode.equals("INCOME")||mode.equals("EXPENSE");
        v.setViewVisibility(R.id.widget_panel,panel?View.VISIBLE:View.GONE);
        v.setViewVisibility(R.id.quick_expense,panel?View.GONE:View.VISIBLE);
        v.setViewVisibility(R.id.widget_controls,launcher?View.GONE:View.VISIBLE);
        v.setTextViewText(R.id.widget_status,message);
        v.setTextViewText(R.id.widget_balance,"SYSTEMATIC MONEY");
        Intent settings=new Intent(c,WidgetConfigActivity.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,id);
        PendingIntent configure=PendingIntent.getActivity(c,id,settings,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.widget_settings,configure);
        Intent refresh=new Intent(c,MoneyWidget.class).setAction(REFRESH).putExtra("widgetId",id).setData(Uri.parse("moneywidget://refresh/"+id));
        v.setOnClickPendingIntent(R.id.widget_refresh,PendingIntent.getBroadcast(c,id,refresh,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
        if(launcher){
            v.setTextViewText(R.id.quick_expense,mode.equals("INCOME")?"+  PŘÍJEM":"−  VÝDAJ");
            v.setOnClickPendingIntent(R.id.quick_expense,form(c,"kind="+mode));
        } else if(panel){
            JSONObject p=snapshot==null?null:snapshot.optJSONObject("panel");
            boolean incomeFirst=p!=null&&p.optBoolean("incomeFirst");
            for(int row=0;row<2;row++){
                boolean income=(row==0)==incomeFirst;
                JSONArray actions=p==null?null:p.optJSONArray(income?"incomes":"expenses");
                for(int n=0;n<5;n++)bind(c,v,SLOTS[row*5+n],actions==null?null:actions.optJSONObject(n));
            }
        } else {
            String selected=WidgetStore.prefs(c).getString("action_"+id,"");
            JSONObject action=null;
            JSONArray actions=snapshot==null?null:snapshot.optJSONArray("actions");
            if(actions!=null)for(int n=0;n<actions.length();n++){JSONObject a=actions.optJSONObject(n);if(a!=null&&a.optString("id").equals(selected))action=a;}
            if(action==null){v.setTextViewText(R.id.quick_expense,"Vybrat rychlou akci");v.setOnClickPendingIntent(R.id.quick_expense,configure);}
            else {
                bind(c,v,R.id.quick_expense,action);
                boolean locked=((KeyguardManager)c.getSystemService(Context.KEYGUARD_SERVICE)).isDeviceLocked();
                if(!locked&&action.optBoolean("showBalance")&&!snapshot.isNull("balance"))v.setTextViewText(R.id.widget_balance,money(snapshot.optString("balance")));
            }
        }
        AppWidgetManager.getInstance(c).updateAppWidget(id,v);
    }
}
