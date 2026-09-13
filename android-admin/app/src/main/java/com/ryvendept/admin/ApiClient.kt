package com.ryvendept.admin

import android.content.Context
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Thin client for the EXISTING RYVEN DEPT backend APIs.
 *
 * - Base URL comes from BuildConfig (public configuration only).
 * - Every admin call sends the session cookie + x-csrf-token header;
 *   authorization is enforced SERVER-side — this app never trusts itself.
 * - All requests run on a background executor; callbacks fire on the main
 *   thread. HTTPS only (the manifest blocks cleartext traffic).
 */
object ApiClient {
    private val JSON = "application/json; charset=utf-8".toMediaType()

    val baseUrl: String get() = BuildConfig.API_BASE_URL

    private val http =
        OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .build()

    private val executor = Executors.newFixedThreadPool(2)
    private var sessionCookie = ""
    private var csrfToken = ""

    sealed class Result {
        data class Ok(val json: JSONObject) : Result()
        data class Error(val message: String, val unauthorized: Boolean = false) : Result()
    }

    interface Callback {
        fun onResult(result: Result)
    }

    private object NoopCallback : Callback {
        override fun onResult(result: Result) = Unit
    }

    fun configure(context: Context) {
        sessionCookie = SessionStore.cookie(context.applicationContext)
        csrfToken = SessionStore.csrf(context.applicationContext)
    }

    fun clearCredentials() {
        sessionCookie = ""
        csrfToken = ""
    }

    // ------------------------------------------------------------------
    // Auth
    // ------------------------------------------------------------------

    /**
     * Admin login against the existing backend endpoint. On success stores
     * the session cookie (from Set-Cookie) and the CSRF token returned in
     * the JSON body. No guest access: this is the only way in.
     */
    fun login(context: Context, username: String, password: String, callback: Callback) {
        run(callback) {
            val request =
                Request.Builder()
                    .url("$baseUrl/api/admin/login")
                    .post(jsonBody(JSONObject().put("username", username).put("password", password)))
                    .build()
            http.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                val json = parse(body)
                val cookie =
                    response.headers("Set-Cookie")
                        .firstOrNull { it.startsWith("ruven_admin_session=") }
                        ?.takeWhile { it != ';' }
                        .orEmpty()
                if (response.isSuccessful && json.optBoolean("ok", false) && cookie.isNotEmpty()) {
                    val csrf = json.optString("csrfToken", "")
                    sessionCookie = cookie
                    csrfToken = csrf
                    SessionStore.saveSession(context.applicationContext, cookie, csrf, username)
                    Result.Ok(json)
                } else {
                    Result.Error(
                        json.optString("error", "Login failed"),
                        unauthorized = response.code == 401,
                    )
                }
            }
        }
    }

    fun logout(context: Context, callback: Callback?) {
        val cookie = sessionCookie
        val csrf = csrfToken
        clearCredentials()
        SessionStore.clear(context.applicationContext)
        val target = callback ?: NoopCallback
        if (cookie.isEmpty()) {
            Main.post { target.onResult(Result.Ok(JSONObject().put("ok", true))) }
            return
        }
        run(target) {
            val request =
                Request.Builder()
                    .url("$baseUrl/api/admin/logout")
                    .post(jsonBody(JSONObject()))
                    .header("Cookie", cookie)
                    .header("x-csrf-token", csrf)
                    .build()
            try {
                http.newCall(request).execute().use { /* session drop is server-side */ }
            } catch (_: Exception) {
                // Local state is already cleared; ignore network failures.
            }
            Result.Ok(JSONObject().put("ok", true))
        }
    }

    // ------------------------------------------------------------------
    // Generic admin requests (auth + CSRF required by the backend)
    // ------------------------------------------------------------------

    fun get(path: String, callback: Callback) {
        run(callback) { request("GET", path, null) }
    }

    fun post(path: String, body: JSONObject, callback: Callback) {
        run(callback) { request("POST", path, body) }
    }

    fun patch(path: String, body: JSONObject, callback: Callback) {
        run(callback) { request("PATCH", path, body) }
    }

    fun delete(path: String, body: JSONObject, callback: Callback) {
        run(callback) { request("DELETE", path, body) }
    }

    private fun request(method: String, path: String, body: JSONObject?): Result {
        if (sessionCookie.isEmpty()) {
            return Result.Error("Not signed in", unauthorized = true)
        }
        val builder =
            Request.Builder()
                .url("$baseUrl$path")
                .header("Cookie", sessionCookie)
                .header("x-csrf-token", csrfToken)
        when (method) {
            "GET" -> builder.get()
            "POST" -> builder.post(jsonBody(body ?: JSONObject()))
            "PATCH" -> builder.patch(jsonBody(body ?: JSONObject()))
            "DELETE" -> builder.delete(jsonBody(body ?: JSONObject()))
        }
        http.newCall(builder.build()).execute().use { response ->
            val json = parse(response.body?.string().orEmpty())
            return if (response.isSuccessful && json.optBoolean("ok", false)) {
                Result.Ok(json)
            } else {
                Result.Error(
                    json.optString("error", "Request failed (${response.code})"),
                    unauthorized = response.code == 401 || response.code == 403,
                )
            }
        }
    }

    // ------------------------------------------------------------------
    // Plumbing
    // ------------------------------------------------------------------

    private fun run(callback: Callback, block: () -> Result) {
        executor.execute {
            val result =
                try {
                    block()
                } catch (e: Exception) {
                    Result.Error(e.message ?: "Network error")
                }
            Main.post { callback.onResult(result) }
        }
    }

    private fun jsonBody(body: JSONObject) = body.toString().toRequestBody(JSON)

    private fun parse(body: String): JSONObject =
        try {
            JSONObject(body)
        } catch (_: Exception) {
            JSONObject()
        }
}

/** Posts work onto the main looper. */
object Main {
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    fun post(block: () -> Unit) {
        handler.post(block)
    }
}
