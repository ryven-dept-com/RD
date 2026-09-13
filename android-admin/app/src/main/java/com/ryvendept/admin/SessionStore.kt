package com.ryvendept.admin

import android.content.Context
import android.content.SharedPreferences

/**
 * Stores the authenticated admin session (cookie + CSRF token) and the
 * last-seen notification id for the unread badge.
 *
 * Storage is MODE_PRIVATE: readable only by this app on this device. The
 * app is intended for the store owner's own device; session lifetime is
 * controlled server-side (7 days, invalidated on password change).
 */
object SessionStore {
    private const val PREFS = "ryven_admin_session"
    private const val KEY_COOKIE = "cookie"
    private const val KEY_CSRF = "csrf"
    private const val KEY_USERNAME = "username"
    private const val KEY_DEVICE_ID = "deviceId"
    private const val KEY_LAST_NOTIF = "lastNotificationId"

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun saveSession(context: Context, cookie: String, csrf: String, username: String) {
        prefs(context)
            .edit()
            .putString(KEY_COOKIE, cookie)
            .putString(KEY_CSRF, csrf)
            .putString(KEY_USERNAME, username)
            .apply()
    }

    fun cookie(context: Context): String =
        prefs(context).getString(KEY_COOKIE, "") ?: ""

    fun csrf(context: Context): String =
        prefs(context).getString(KEY_CSRF, "") ?: ""

    fun username(context: Context): String =
        prefs(context).getString(KEY_USERNAME, "") ?: ""

    fun isLoggedIn(context: Context): Boolean =
        cookie(context).isNotEmpty() && csrf(context).isNotEmpty()

    /** Server-side id of this device's registration (for unregister/refresh). */
    fun deviceId(context: Context): Long = prefs(context).getLong(KEY_DEVICE_ID, -1L)

    fun setDeviceId(context: Context, id: Long) {
        prefs(context).edit().putLong(KEY_DEVICE_ID, id).apply()
    }

    fun lastNotificationId(context: Context): Long =
        prefs(context).getLong(KEY_LAST_NOTIF, 0L)

    fun setLastNotificationId(context: Context, id: Long) {
        prefs(context).edit().putLong(KEY_LAST_NOTIF, id).apply()
    }

    fun clear(context: Context) {
        prefs(context).edit().clear().apply()
    }
}
