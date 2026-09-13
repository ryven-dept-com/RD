package com.ryvendept.admin

import android.content.Context
import android.os.Build
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject

/**
 * Registers the authorized admin device with the EXISTING backend
 * (POST /api/admin/devices — authenticated admin session + CSRF required).
 * The push token is a provider handle, never a credential; only the
 * server uses it to deliver new-order alerts to this device.
 */
object DeviceRegistrar {

    /** Fetch the current FCM token (if Firebase is configured) and register it. */
    fun registerWhenPossible(context: Context) {
        if (!SessionStore.isLoggedIn(context)) return
        try {
            if (FirebaseApp.getApps(context).isEmpty()) return
            FirebaseMessaging.getInstance()
                .token
                .addOnCompleteListener { task ->
                    if (!task.isSuccessful) return@addOnCompleteListener
                    val token = task.result ?: return@addOnCompleteListener
                    send(context, token)
                }
        } catch (_: Exception) {
            // Push not configured on this build — the in-app notification
            // history still works.
        }
    }

    fun send(context: Context, token: String) {
        if (!SessionStore.isLoggedIn(context)) return
        val body =
            JSONObject()
                .put("provider", "fcm")
                .put("token", token)
                .put("deviceName", deviceName())
        ApiClient.post(
            "/api/admin/devices",
            body,
            object : ApiClient.Callback {
                override fun onResult(result: ApiClient.Result) {
                    if (result is ApiClient.Result.Ok) {
                        val id = result.json.optJSONObject("device")?.optLong("id", -1) ?: -1L
                        if (id > 0) SessionStore.setDeviceId(context, id)
                    }
                }
            },
        )
    }

    private fun deviceName(): String =
        ("${Build.MANUFACTURER} ${Build.MODEL}".trim()).ifEmpty { "Admin device" }.take(120)
}
