package com.ryvendept.admin

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions

/**
 * Application entry point for the private admin app.
 *
 * - Creates the admin notification channel (new-order alerts).
 * - Initializes Firebase manually from string resources — the project builds
 *   and runs even before Firebase is configured (push is optional; the
 *   in-app notification history always works).
 */
class AdminApp : Application() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        initFirebaseIfConfigured()
        ApiClient.configure(this)
    }

    private fun createNotificationChannel() {
        val manager = getSystemService(NotificationManager::class.java) ?: return
        val channel =
            NotificationChannel(
                CHANNEL_ADMIN_ORDERS,
                getString(R.string.channel_orders_name),
                NotificationManager.IMPORTANCE_HIGH,
            )
        channel.description = getString(R.string.channel_orders_desc)
        manager.createNotificationChannel(channel)
    }

    private fun initFirebaseIfConfigured() {
        val senderId = getString(R.string.fcm_sender_id)
        val applicationId = getString(R.string.fcm_application_id)
        val projectId = getString(R.string.fcm_project_id)
        if (senderId.startsWith("REPLACE") || applicationId.startsWith("REPLACE")) {
            // Push not configured yet — the app still works: notifications
            // are recorded server-side and visible in the in-app history.
            return
        }
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                val options =
                    FirebaseOptions.Builder()
                        .setApplicationId(applicationId)
                        .setGcmSenderId(senderId)
                        .setProjectId(projectId)
                        .build()
                FirebaseApp.initializeApp(this, options)
            }
        } catch (e: Exception) {
            android.util.Log.w("AdminApp", "Firebase init skipped: ${e.message}")
        }
    }

    companion object {
        const val CHANNEL_ADMIN_ORDERS = "admin_orders"
    }
}
