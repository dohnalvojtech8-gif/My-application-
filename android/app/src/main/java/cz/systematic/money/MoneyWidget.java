package cz.systematic.money;
import android.app.PendingIntent;
import android.appwidget.AppWidgetProvider;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
public class MoneyWidget extends AppWidgetProvider {
 @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){
  for(int id:ids){RemoteViews view=new RemoteViews(context.getPackageName(),R.layout.money_widget);
   Intent intent=new Intent(context,MainActivity.class);intent.putExtra("quickExpense",true);intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP);
   view.setOnClickPendingIntent(R.id.quick_expense,PendingIntent.getActivity(context,id,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));manager.updateAppWidget(id,view);
  }
 }
}
