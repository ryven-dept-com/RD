package com.ryvendept.admin

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.Spinner
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.bottomnavigation.BottomNavigationView
import org.json.JSONArray

/**
 * Main admin screen: Dashboard, Orders, Products and Notifications.
 * Every number comes from the existing backend APIs — the app never
 * computes or invents data, and every request is authorized server-side.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var nav: BottomNavigationView

    private lateinit var dashboardRefresh: SwipeRefreshLayout
    private lateinit var ordersContainer: View
    private lateinit var productsContainer: View
    private lateinit var notificationsContainer: View

    // Dashboard
    private lateinit var statOrdersToday: TextView
    private lateinit var statRevenueToday: TextView
    private lateinit var statNewOrders: TextView
    private lateinit var statPending: TextView
    private lateinit var statProductsSold: TextView
    private lateinit var dashboardError: TextView

    // Orders
    private lateinit var ordersSearch: EditText
    private lateinit var ordersStatusFilter: Spinner
    private lateinit var ordersRefresh: SwipeRefreshLayout
    private lateinit var ordersList: RecyclerView
    private lateinit var ordersEmpty: TextView
    private val ordersAdapter = OrdersAdapter { order -> openOrder(order.id, order.orderNumber) }

    // Products
    private lateinit var productsSearch: EditText
    private lateinit var productsRefresh: SwipeRefreshLayout
    private lateinit var productsList: RecyclerView
    private lateinit var productsEmpty: TextView
    private val productsAdapter = ProductsAdapter()

    // Notifications
    private lateinit var notificationsRefresh: SwipeRefreshLayout
    private lateinit var notificationsList: RecyclerView
    private lateinit var notificationsEmpty: TextView
    private val notificationsAdapter =
        NotificationsAdapter { item -> openOrder(item.orderId, item.orderNumber) }

    private var dashboardLoaded = false
    private var ordersLoaded = false
    private var productsLoaded = false
    private var notificationsLoaded = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!SessionStore.isLoggedIn(this)) {
            openLogin()
            return
        }
        ApiClient.configure(this)
        setContentView(R.layout.activity_main)

        val toolbar = findViewById<Toolbar>(R.id.main_toolbar)
        setSupportActionBar(toolbar)

        nav = findViewById(R.id.main_nav)
        dashboardRefresh = findViewById(R.id.dashboard_refresh)
        ordersContainer = findViewById(R.id.orders_container)
        productsContainer = findViewById(R.id.products_container)
        notificationsContainer = findViewById(R.id.notifications_container)

        statOrdersToday = findViewById(R.id.stat_orders_today)
        statRevenueToday = findViewById(R.id.stat_revenue_today)
        statNewOrders = findViewById(R.id.stat_new_orders)
        statPending = findViewById(R.id.stat_pending)
        statProductsSold = findViewById(R.id.stat_products_sold)
        dashboardError = findViewById(R.id.dashboard_error)

        ordersSearch = findViewById(R.id.orders_search)
        ordersStatusFilter = findViewById(R.id.orders_status_filter)
        ordersRefresh = findViewById(R.id.orders_refresh)
        ordersList = findViewById(R.id.orders_list)
        ordersEmpty = findViewById(R.id.orders_empty)

        productsSearch = findViewById(R.id.products_search)
        productsRefresh = findViewById(R.id.products_refresh)
        productsList = findViewById(R.id.products_list)
        productsEmpty = findViewById(R.id.products_empty)

        notificationsRefresh = findViewById(R.id.notifications_refresh)
        notificationsList = findViewById(R.id.notifications_list)
        notificationsEmpty = findViewById(R.id.notifications_empty)

        ordersList.layoutManager = LinearLayoutManager(this)
        ordersList.adapter = ordersAdapter
        productsList.layoutManager = LinearLayoutManager(this)
        productsList.adapter = productsAdapter
        notificationsList.layoutManager = LinearLayoutManager(this)
        notificationsList.adapter = notificationsAdapter

        setupStatusFilter()
        setupSearchActions()
        setupRefresh()

        nav.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_dashboard -> showTab(0)
                R.id.nav_orders -> showTab(1)
                R.id.nav_products -> showTab(2)
                R.id.nav_notifications -> showTab(3)
                else -> return@setOnItemSelectedListener false
            }
            true
        }

        showTab(0)
        refreshNotificationsBadge()
        requestNotificationPermission()
    }

    /**
     * Android 13+ requires a runtime permission before the app can post
     * new-order notifications. Asked once, right after sign-in.
     */
    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
                PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1001)
        }
    }

    override fun onResume() {
        super.onResume()
        // Keep the device registration fresh (token refresh / re-login).
        DeviceRegistrar.registerWhenPossible(this)
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.main_menu, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        if (item.itemId == R.id.action_logout) {
            ApiClient.logout(this, null)
            openLogin()
            return true
        }
        return super.onOptionsItemSelected(item)
    }

    // ------------------------------------------------------------------
    // Tabs
    // ------------------------------------------------------------------

    private fun showTab(index: Int) {
        dashboardRefresh.visibility = if (index == 0) View.VISIBLE else View.GONE
        ordersContainer.visibility = if (index == 1) View.VISIBLE else View.GONE
        productsContainer.visibility = if (index == 2) View.VISIBLE else View.GONE
        notificationsContainer.visibility = if (index == 3) View.VISIBLE else View.GONE

        when (index) {
            0 -> if (!dashboardLoaded) loadDashboard()
            1 -> if (!ordersLoaded) loadOrders()
            2 -> if (!productsLoaded) loadProducts()
            3 -> if (!notificationsLoaded) loadNotifications()
        }
    }

    private fun setupStatusFilter() {
        val labels = ArrayList<String>()
        labels.add(getString(R.string.orders_filter_all))
        OrderStatus.ALL.forEach { labels.add(OrderStatus.label(this, it)) }
        ordersStatusFilter.adapter =
            ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, labels)
        ordersStatusFilter.onItemSelectedListener =
            object : android.widget.AdapterView.OnItemSelectedListener {
                override fun onItemSelected(
                    parent: android.widget.AdapterView<*>?,
                    view: View?,
                    position: Int,
                    id: Long,
                ) {
                    if (ordersLoaded || position > 0) loadOrders()
                }

                override fun onNothingSelected(parent: android.widget.AdapterView<*>?) = Unit
            }
    }

    private fun setupSearchActions() {
        ordersSearch.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH) {
                loadOrders()
                true
            } else false
        }
        productsSearch.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH) {
                loadProducts()
                true
            } else false
        }
    }

    private fun setupRefresh() {
        dashboardRefresh.setOnRefreshListener { loadDashboard() }
        ordersRefresh.setOnRefreshListener { loadOrders() }
        productsRefresh.setOnRefreshListener { loadProducts() }
        notificationsRefresh.setOnRefreshListener { loadNotifications() }
    }

    // ------------------------------------------------------------------
    // Dashboard
    // ------------------------------------------------------------------

    private fun loadDashboard() {
        dashboardError.visibility = View.GONE
        dashboardRefresh.isRefreshing = true
        ApiClient.get(
            "/api/admin/dashboard",
            object : ApiClient.Callback {
                override fun onResult(result: ApiClient.Result) {
                    dashboardRefresh.isRefreshing = false
                    when (result) {
                        is ApiClient.Result.Ok -> {
                            dashboardLoaded = true
                            val today = result.json.optJSONObject("today")
                            val counts = result.json.optJSONObject("orders")
                            val currency = today?.optString("currency").orEmpty().ifEmpty { "DZD" }
                            statOrdersToday.text =
                                (today?.optInt("orders") ?: 0).toString()
                            statRevenueToday.text =
                                formatMoney(today?.optInt("revenue") ?: 0, currency)
                            statNewOrders.text = (counts?.optInt("new") ?: 0).toString()
                            statPending.text = (counts?.optInt("pending") ?: 0).toString()
                            statProductsSold.text =
                                (today?.optInt("productsSold") ?: 0).toString()
                        }
                        is ApiClient.Result.Error -> {
                            if (result.unauthorized) {
                                sessionExpired()
                                return
                            }
                            dashboardError.text = result.message
                            dashboardError.visibility = View.VISIBLE
                        }
                    }
                }
            },
        )
    }

    // ------------------------------------------------------------------
    // Orders
    // ------------------------------------------------------------------

    private fun loadOrders() {
        ordersRefresh.isRefreshing = true
        val q = ordersSearch.text.toString().trim()
        val statusIndex = ordersStatusFilter.selectedItemPosition
        val status = if (statusIndex > 0) OrderStatus.ALL[statusIndex - 1] else ""
        val path =
            buildString {
                append("/api/admin/orders?pageSize=50&sort=newest")
                if (q.isNotEmpty()) append("&q=").append(java.net.URLEncoder.encode(q, "UTF-8"))
                if (status.isNotEmpty())
                    append("&status=").append(java.net.URLEncoder.encode(status, "UTF-8"))
            }
        ApiClient.get(
            path,
            object : ApiClient.Callback {
                override fun onResult(result: ApiClient.Result) {
                    ordersRefresh.isRefreshing = false
                    when (result) {
                        is ApiClient.Result.Ok -> {
                            ordersLoaded = true
                            val rows =
                                jsonArrayToList(result.json.optJSONArray("orders")) {
                                    OrderSummary.fromJson(it)
                                }
                            ordersAdapter.submit(rows)
                            ordersEmpty.visibility =
                                if (rows.isEmpty()) View.VISIBLE else View.GONE
                        }
                        is ApiClient.Result.Error -> {
                            if (result.unauthorized) sessionExpired()
                            else {
                                ordersAdapter.submit(emptyList())
                                ordersEmpty.text = result.message
                                ordersEmpty.visibility = View.VISIBLE
                            }
                        }
                    }
                }
            },
        )
    }

    // ------------------------------------------------------------------
    // Products
    // ------------------------------------------------------------------

    private fun loadProducts() {
        productsRefresh.isRefreshing = true
        val q = productsSearch.text.toString().trim()
        val path =
            if (q.isEmpty()) "/api/admin/products"
            else "/api/admin/products?q=" + java.net.URLEncoder.encode(q, "UTF-8")
        ApiClient.get(
            path,
            object : ApiClient.Callback {
                override fun onResult(result: ApiClient.Result) {
                    productsRefresh.isRefreshing = false
                    when (result) {
                        is ApiClient.Result.Ok -> {
                            productsLoaded = true
                            val rows =
                                jsonArrayToList(result.json.optJSONArray("products")) {
                                    ProductRow.fromJson(it)
                                }
                            productsAdapter.submit(rows)
                            productsEmpty.visibility =
                                if (rows.isEmpty()) View.VISIBLE else View.GONE
                        }
                        is ApiClient.Result.Error -> {
                            if (result.unauthorized) sessionExpired()
                            else {
                                productsAdapter.submit(emptyList())
                                productsEmpty.text = result.message
                                productsEmpty.visibility = View.VISIBLE
                            }
                        }
                    }
                }
            },
        )
    }

    // ------------------------------------------------------------------
    // Notifications
    // ------------------------------------------------------------------

    private fun loadNotifications() {
        notificationsRefresh.isRefreshing = true
        ApiClient.get(
            "/api/admin/notifications?limit=100",
            object : ApiClient.Callback {
                override fun onResult(result: ApiClient.Result) {
                    notificationsRefresh.isRefreshing = false
                    when (result) {
                        is ApiClient.Result.Ok -> {
                            notificationsLoaded = true
                            val rows =
                                jsonArrayToList(result.json.optJSONArray("notifications")) {
                                    NotificationRow.fromJson(it)
                                }
                            notificationsAdapter.submit(rows, SessionStore.lastNotificationId(this@MainActivity))
                            val newest = rows.maxOfOrNull { it.id } ?: 0L
                            if (newest > 0) {
                                SessionStore.setLastNotificationId(this@MainActivity, newest)
                            }
                            notificationsEmpty.visibility =
                                if (rows.isEmpty()) View.VISIBLE else View.GONE
                            clearNotificationsBadge()
                        }
                        is ApiClient.Result.Error -> {
                            if (result.unauthorized) sessionExpired()
                            else {
                                notificationsAdapter.submit(emptyList(), 0)
                                notificationsEmpty.text = result.message
                                notificationsEmpty.visibility = View.VISIBLE
                            }
                        }
                    }
                }
            },
        )
    }

    private fun refreshNotificationsBadge() {
        // Quick silent poll for the unread count indicator.
        ApiClient.get(
            "/api/admin/notifications?limit=20",
            object : ApiClient.Callback {
                override fun onResult(result: ApiClient.Result) {
                    if (result !is ApiClient.Result.Ok) return
                    val rows: JSONArray = result.json.optJSONArray("notifications") ?: JSONArray()
                    val lastSeen = SessionStore.lastNotificationId(this@MainActivity)
                    var unread = 0
                    for (i in 0 until rows.length()) {
                        if ((rows.optJSONObject(i)?.optLong("id") ?: 0L) > lastSeen) unread++
                    }
                    if (unread > 0) {
                        val badge = nav.getOrCreateBadge(R.id.nav_notifications)
                        badge.number = unread
                    } else {
                        clearNotificationsBadge()
                    }
                }
            },
        )
    }

    private fun clearNotificationsBadge() {
        nav.removeBadge(R.id.nav_notifications)
    }

    // ------------------------------------------------------------------
    // Navigation helpers
    // ------------------------------------------------------------------

    private fun openOrder(orderId: Int, orderNumber: String) {
        if (orderId <= 0) return
        startActivity(
            Intent(this, OrderDetailsActivity::class.java)
                .putExtra(OrderDetailsActivity.EXTRA_ORDER_ID, orderId)
                .putExtra(OrderDetailsActivity.EXTRA_ORDER_NUMBER, orderNumber),
        )
    }

    private fun sessionExpired() {
        SessionStore.clear(this)
        openLogin()
    }

    private fun openLogin() {
        startActivity(Intent(this, LoginActivity::class.java))
        finish()
    }
}
