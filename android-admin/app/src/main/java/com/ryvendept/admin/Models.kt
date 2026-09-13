package com.ryvendept.admin

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Display models parsed from the existing backend API responses.
 * Amounts are INTEGER CENTS (DZD) everywhere — same convention as the
 * storefront and the admin panel.
 */

data class OrderSummary(
    val id: Int,
    val orderNumber: String,
    val fullName: String,
    val phone: String,
    val total: Int,
    val currency: String,
    val status: String,
    val paymentStatus: String,
    val deliveryMethod: String,
    val deliveryStatus: String,
    val itemCount: Int,
    val createdAt: String,
) {
    companion object {
        fun fromJson(o: JSONObject) =
            OrderSummary(
                id = o.optInt("id"),
                orderNumber = o.optString("orderNumber"),
                fullName = o.optString("fullName"),
                phone = o.optString("phone"),
                total = o.optInt("total"),
                currency = o.optString("currency").ifEmpty { "DZD" },
                status = o.optString("status"),
                paymentStatus = o.optString("paymentStatus"),
                deliveryMethod = o.optString("deliveryMethod"),
                deliveryStatus = o.optString("deliveryStatus"),
                itemCount = o.optInt("itemCount"),
                createdAt = o.optString("createdAt"),
            )
    }
}

data class OrderItemRow(
    val name: String,
    val price: Int,
    val quantity: Int,
    val size: String,
    val color: String,
    val sku: String,
) {
    companion object {
        fun fromJson(o: JSONObject) =
            OrderItemRow(
                name = o.optString("name"),
                price = o.optInt("price"),
                quantity = o.optInt("quantity"),
                size = o.optString("size"),
                color = o.optString("color"),
                sku = o.optString("sku"),
            )
    }
}

data class NoteRow(val author: String, val body: String, val createdAt: String) {
    companion object {
        fun fromJson(o: JSONObject) =
            NoteRow(
                author = o.optString("author"),
                body = o.optString("body"),
                createdAt = o.optString("createdAt"),
            )
    }
}

data class EventRow(
    val kind: String,
    val fromValue: String,
    val toValue: String,
    val actor: String,
    val note: String,
    val createdAt: String,
) {
    companion object {
        fun fromJson(o: JSONObject) =
            EventRow(
                kind = o.optString("kind"),
                fromValue = o.optString("fromValue"),
                toValue = o.optString("toValue"),
                actor = o.optString("actor"),
                note = o.optString("note"),
                createdAt = o.optString("createdAt"),
            )
    }
}

data class ProductRow(
    val id: Int,
    val name: String,
    val slug: String,
    val sku: String,
    val price: Int,
    val stock: Int,
    val totalStock: Int,
    val variantCount: Int,
    val status: String,
    val category: String,
) {
    companion object {
        fun fromJson(o: JSONObject) =
            ProductRow(
                id = o.optInt("id"),
                name = o.optString("name"),
                slug = o.optString("slug"),
                sku = o.optString("sku"),
                price = o.optInt("price"),
                stock = o.optInt("stock"),
                totalStock = o.optInt("totalStock", o.optInt("stock")),
                variantCount = o.optInt("variantCount"),
                status = o.optString("status"),
                category = o.optString("category"),
            )
    }
}

data class NotificationRow(
    val id: Long,
    val orderId: Int,
    val orderNumber: String,
    val type: String,
    val title: String,
    val body: String,
    val createdAt: String,
) {
    companion object {
        fun fromJson(o: JSONObject) =
            NotificationRow(
                id = o.optLong("id"),
                orderId = o.optInt("orderId"),
                orderNumber = o.optString("orderNumber"),
                type = o.optString("type"),
                title = o.optString("title"),
                body = o.optString("body"),
                createdAt = o.optString("createdAt"),
            )
    }
}

fun <T> jsonArrayToList(array: JSONArray?, mapper: (JSONObject) -> T): List<T> {
    if (array == null) return emptyList()
    val out = ArrayList<T>(array.length())
    for (i in 0 until array.length()) {
        val item = array.optJSONObject(i) ?: continue
        out.add(mapper(item))
    }
    return out
}

// ---------------------------------------------------------------------------
// Formatting helpers (money in cents, ISO dates from the API)
// ---------------------------------------------------------------------------

fun formatMoney(cents: Int, currency: String = "DZD"): String {
    val format = NumberFormat.getNumberInstance(Locale.getDefault())
    format.minimumFractionDigits = 2
    format.maximumFractionDigits = 2
    return "${format.format(cents / 100.0)} $currency"
}

private val isoFormat: SimpleDateFormat
    get() =
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }

fun formatDateTime(iso: String): String {
    if (iso.isEmpty()) return "—"
    return try {
        val date: Date = isoFormat.parse(iso) ?: return iso
        val out =
            SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).apply {
                timeZone = TimeZone.getDefault()
            }
        out.format(date)
    } catch (_: Exception) {
        iso
    }
}

// ---------------------------------------------------------------------------
// Order statuses — stored server-side as Arabic strings. The app shows a
// localized label but ALWAYS sends the canonical Arabic value unchanged.
// ---------------------------------------------------------------------------

object OrderStatus {
    const val NEW = "جديد"
    const val CONFIRMED = "تم التأكيد"
    const val PREPARING = "قيد التحضير"
    const val SHIPPED = "تم الشحن"
    const val DELIVERED = "تم التسليم"
    const val CANCELLED = "ملغى"
    const val RETURNED = "مرجع"

    val ALL = listOf(NEW, CONFIRMED, PREPARING, SHIPPED, DELIVERED, CANCELLED, RETURNED)

    /** Localized label for a stored status (falls back to the raw value). */
    fun label(context: Context, status: String): String {
        val res = context.resources
        return when (status) {
            NEW -> res.getString(R.string.status_new)
            CONFIRMED -> res.getString(R.string.status_confirmed)
            PREPARING -> res.getString(R.string.status_preparing)
            SHIPPED -> res.getString(R.string.status_shipped)
            DELIVERED -> res.getString(R.string.status_delivered)
            CANCELLED -> res.getString(R.string.status_cancelled)
            RETURNED -> res.getString(R.string.status_returned)
            else -> status
        }
    }
}

object DeliveryStatus {
    fun label(context: Context, status: String): String {
        val res = context.resources
        return when (status) {
            "not_ready" -> res.getString(R.string.delivery_not_ready)
            "ready" -> res.getString(R.string.delivery_ready)
            "handed_to_courier" -> res.getString(R.string.delivery_handed)
            "in_transit" -> res.getString(R.string.delivery_in_transit)
            "delivered" -> res.getString(R.string.delivery_delivered)
            "returned" -> res.getString(R.string.delivery_returned)
            else -> status
        }
    }
}
