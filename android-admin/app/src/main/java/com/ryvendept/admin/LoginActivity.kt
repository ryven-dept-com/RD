package com.ryvendept.admin

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

/**
 * Admin login — the only entry point of the app. There is no guest mode,
 * no registration and no customer accounts: credentials are verified by
 * the existing backend (scrypt hashes, rate of one session per login).
 */
class LoginActivity : AppCompatActivity() {

    private lateinit var username: EditText
    private lateinit var password: EditText
    private lateinit var signIn: Button
    private lateinit var progress: ProgressBar
    private lateinit var error: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (SessionStore.isLoggedIn(this)) {
            ApiClient.configure(this)
            openMain()
            return
        }
        setContentView(R.layout.activity_login)

        username = findViewById(R.id.login_username)
        password = findViewById(R.id.login_password)
        signIn = findViewById(R.id.login_button)
        progress = findViewById(R.id.login_progress)
        error = findViewById(R.id.login_error)

        signIn.setOnClickListener { attemptLogin() }
    }

    private fun attemptLogin() {
        val user = username.text.toString().trim()
        val pass = password.text.toString()
        if (user.isEmpty() || pass.isEmpty()) {
            error.text = getString(R.string.login_fill_all)
            error.visibility = View.VISIBLE
            return
        }
        setLoading(true)
        error.visibility = View.GONE

        ApiClient.login(
            this,
            user,
            pass,
            object : ApiClient.Callback {
                override fun onResult(result: ApiClient.Result) {
                    setLoading(false)
                    when (result) {
                        is ApiClient.Result.Ok -> {
                            // Register this device for push (best effort).
                            DeviceRegistrar.registerWhenPossible(this@LoginActivity)
                            openMain()
                        }
                        is ApiClient.Result.Error -> {
                            error.text = result.message
                            error.visibility = View.VISIBLE
                        }
                    }
                }
            },
        )
    }

    private fun setLoading(loading: Boolean) {
        progress.visibility = if (loading) View.VISIBLE else View.GONE
        signIn.isEnabled = !loading
        username.isEnabled = !loading
        password.isEnabled = !loading
    }

    private fun openMain() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
