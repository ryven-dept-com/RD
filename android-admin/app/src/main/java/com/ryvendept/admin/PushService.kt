package com.ryvendept.admin

import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * FCM handler for private ADMIN notifications (new orders). Customers are
 * never reached by this channel — it exists only for the registered admin
 * device. Tapping the notification opens the corresponding order details.
 */
class PushService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        val title =
            message.notification?.title
                ?: data["title"]
                ?: getString(R.string.app_name)
        val body =
            message.notification?.body
                ?: data["body"]
                ?: return
        val orderId = data["orderId"]?.toIntOrNull() ?: 0
        val orderNumber = data["orderNumber"].orEmpty()

        val intent =
            Intent(this, OrderDetailsActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra(OrderDetailsActivity.EXTRA_ORDER_ID, orderId)
                putExtra(OrderDetailsActivity.EXTRA_ORDER_NUMBER, orderNumber)
            }
        val pending =
            PendingIntent.getActivity(
                this,
                orderId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

        val notification =
            NotificationCompat.Builder(this, AdminApp.CHANNEL_ADMIN_ORDERS)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(pending)
                .build()

        val manager =
            getSystemService(android.app.NotificationManager::class.java) ?: return
        // The per-order id makes retries replace the same notification
        // instead of stacking duplicates.
        manager.notify(if (orderId > 0) orderId else body.hashCode(), notification)
    }

    override fun onNewToken(token: String) {
        // Keep the backend registration in sync for the logged-in admin.
        DeviceRegistrar.send(applicationContext, token)
    }
}
