package com.ryvendept.admin

import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.ProgressBar
import android.widget.Spinner
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.snackbar.Snackbar
import org.json.JSONObject

/**
 * Full order view: customer, items with variants, totals, delivery,
 * status, notes and history. Opened from the orders list or directly
 * from a new-order push notification (deep link by order id).
 *
 * Fast order management: the status can be moved through the same
 * server-side lifecycle as the web admin (PATCH /api/admin/orders/{id}).
 */
class OrderDetailsActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_ORDER_ID = "orderId"
        const val EXTRA_ORDER_NUMBER = "orderNumber"
    }

    private var orderId: Int = 0
    private var currentStatus: String = ""

    private lateinit var root: View
    private lateinit var progress: ProgressBar
    private lateinit var content: View
    private lateinit var errorText: TextView

    private lateinit var numberText: TextView
    private lateinit var dateText: TextView
    private lateinit var statusChip: TextView
    private lateinit var customerName: TextView
    private lateinit var customerPhone: TextView
    private lateinit var customerWilaya: TextView
    private lateinit var customerCommune: TextView
    private lateinit var itemsList: RecyclerView
    private lateinit var itemsCount: TextView
    private lateinit var subtotalText: TextView
    private lateinit var shippingText: TextView
    private lateinit var totalText: TextView
    private lateinit var deliveryMethodText: TextView
    private lateinit var deliveryStatusText: TextView
    private lateinit var notesList: RecyclerView
    private lateinit var notesEmpty: TextView
    private lateinit var eventsList: RecyclerView
    private lateinit var eventsEmpty: TextView

    private lateinit var statusSpinner: Spinner
    private lateinit var updateStatusButton: Button

    private val itemsAdapter = OrderItemsAdapter()
    private val notesAdapter = NotesAdapter()
    private val eventsAdapter = EventsAdapter()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!SessionStore.isLoggedIn(this)) {
            finish()
            return
        }
        ApiClient.configure(this)
        setContentView(R.layout.activity_order_details)

        orderId = intent.getIntExtra(EXTRA_ORDER_ID, 0)
        val numberHint = intent.getStringExtra(EXTRA_ORDER_NUMBER).orEmpty()

        root = findViewById(R.id.order_root)
        findViewById<androidx.appcompat.widget.Toolbar>(R.id.detail_toolbar)
            .setNavigationOnClickListener { finish() }
        progress = findViewById(R.id.order_progress)
        content = findViewById(R.id.order_content)
        errorText = findViewById(R.id.order_error)

        numberText = findViewById(R.id.detail_number)
        dateText = findViewById(R.id.detail_date)
        statusChip = findViewById(R.id.detail_status)
        customerName = findViewById(R.id.detail_customer_name)
        customerPhone = findViewById(R.id.detail_customer_phone)
        customerWilaya = findViewById(R.id.detail_wilaya)
        customerCommune = findViewById(R.id.detail_commune)
        itemsList = findViewById(R.id.detail_items)
        itemsCount = findViewById(R.id.detail_items_count)
        subtotalText = findViewById(R.id.detail_subtotal)
        shippingText = findViewById(R.id.detail_shipping)
        totalText = findViewById(R.id.detail_total)
        deliveryMethodText = findViewById(R.id.detail_delivery_method)
        deliveryStatusText = findViewById(R.id.detail_delivery_status)
        notesList = findViewById(R.id.detail_notes)
        notesEmpty = findViewById(R.id.detail_notes_empty)
        eventsList = findViewById(R.id.detail_events)
        eventsEmpty = findViewById(R.id.detail_events_empty)
        statusSpinner = findViewById(R.id.detail_status_spinner)
        updateStatusButton = findViewById(R.id.detail_update_status)

        itemsList.layoutManager = LinearLayoutManager(this)
        itemsList.adapter = itemsAdapter
        itemsList.isNestedScrollingEnabled = false
        notesList.layoutManager = LinearLayoutManager(this)
        notesList.adapter = notesAdapter
        notesList.isNestedScrollingEnabled = false
        eventsList.layoutManager = LinearLayoutManager(this)
        eventsList.adapter = eventsAdapter
        eventsList.isNestedScrollingEnabled = false

        if (orderId <= 0) {
            showError(getString(R.string.order_not_found))
            return
        }
        if (numberHint.isNotEmpty()) {
            numberText.text = numberHint
        }
        loadOrder()
    }

    private fun loadOrder() {
        progress.visibility = View.VISIBLE
        content.visibility = View.GONE
        errorText.visibility = View.GONE

        ApiClient.get(
            "/api/admin/orders/$orderId",
            object : ApiClient.Callback {
                override fun onResult(result: ApiClient.Result) {
                    progress.visibility = View.GONE
                    when (result) {
                        is ApiClient.Result.Ok -> render(result.json)
                        is ApiClient.Result.Error -> {
                            if (result.unauthorized) {
                                SessionStore.clear(this@OrderDetailsActivity)
                            }
                            showError(result.message)
                        }
                    }
                }
            },
        )
    }

    private fun render(json: JSONObject) {
        val order = json.optJSONObject("order") ?: return showError(getString(R.string.order_not_found))
        val currency = order.optString("currency").ifEmpty { "DZD" }

        currentStatus = order.optString("status")
        numberText.text = order.optString("orderNumber")
        dateText.text = formatDateTime(order.optString("createdAt"))
        statusChip.text = OrderStatus.label(this, currentStatus)

        customerName.text = order.optString("fullName")
        customerPhone.text = order.optString("phone").ifEmpty { "—" }
        customerWilaya.text = order.optString("wilaya").ifEmpty { "—" }
        customerCommune.text = order.optString("commune").ifEmpty { "—" }

        val items = jsonArrayToList(order.optJSONArray("items")) { OrderItemRow.fromJson(it) }
        itemsAdapter.submit(items)
        val unitCount = items.sumOf { it.quantity }
        itemsCount.text = getString(R.string.order_items_count, unitCount)

        subtotalText.text = formatMoney(order.optInt("subtotal"), currency)
        shippingText.text = formatMoney(order.optInt("deliveryPrice", order.optInt("shipping")), currency)
        totalText.text = formatMoney(order.optInt("total"), currency)

        val method = order.optString("deliveryMethod")
        deliveryMethodText.text =
            when (method) {
                "home" -> getString(R.string.delivery_method_home)
                "office" -> getString(R.string.delivery_method_office)
                else -> method.ifEmpty { "—" }
            }
        deliveryStatusText.text = DeliveryStatus.label(this, order.optString("deliveryStatus"))

        val notes = jsonArrayToList(json.optJSONArray("notes")) { NoteRow.fromJson(it) }
        notesAdapter.submit(notes)
        notesEmpty.visibility = if (notes.isEmpty()) View.VISIBLE else View.GONE

        val events = jsonArrayToList(json.optJSONArray("events")) { EventRow.fromJson(it) }
        eventsAdapter.submit(events)
        eventsEmpty.visibility = if (events.isEmpty()) View.VISIBLE else View.GONE

        setupStatusControls()
        content.visibility = View.VISIBLE
    }

    private fun setupStatusControls() {
        val labels = OrderStatus.ALL.map { OrderStatus.label(this, it) }
        statusSpinner.adapter =
            ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, labels)
        val currentIndex = OrderStatus.ALL.indexOf(currentStatus)
        if (currentIndex >= 0) statusSpinner.setSelection(currentIndex)

        updateStatusButton.setOnClickListener {
            val target = OrderStatus.ALL[statusSpinner.selectedItemPosition]
            if (target == currentStatus) {
                Snackbar.make(root, R.string.order_status_unchanged, Snackbar.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            updateStatusButton.isEnabled = false
            ApiClient.patch(
                "/api/admin/orders/$orderId",
                JSONObject().put("status", target),
                object : ApiClient.Callback {
                    override fun onResult(result: ApiClient.Result) {
                        updateStatusButton.isEnabled = true
                        when (result) {
                            is ApiClient.Result.Ok -> {
                                currentStatus = target
                                statusChip.text = OrderStatus.label(this@OrderDetailsActivity, target)
                                Snackbar.make(root, R.string.order_status_updated, Snackbar.LENGTH_SHORT).show()
                            }
                            is ApiClient.Result.Error ->
                                Snackbar.make(root, result.message, Snackbar.LENGTH_LONG).show()
                        }
                    }
                },
            )
        }
    }

    private fun showError(message: String) {
        content.visibility = View.GONE
        progress.visibility = View.GONE
        errorText.text = message
        errorText.visibility = View.VISIBLE
    }
}
