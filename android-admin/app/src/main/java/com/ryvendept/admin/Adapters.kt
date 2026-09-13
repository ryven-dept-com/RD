package com.ryvendept.admin

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class OrdersAdapter(private val onClick: (OrderSummary) -> Unit) :
    RecyclerView.Adapter<OrdersAdapter.Holder>() {

    private val items = mutableListOf<OrderSummary>()

    fun submit(rows: List<OrderSummary>) {
        items.clear()
        items.addAll(rows)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder =
        Holder(
            LayoutInflater.from(parent.context)
                .inflate(R.layout.item_order, parent, false),
        )

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: Holder, position: Int) {
        val order = items[position]
        val context = holder.itemView.context
        holder.number.text = order.orderNumber
        holder.customer.text = order.fullName
        holder.whenText.text = formatDateTime(order.createdAt)
        holder.total.text = formatMoney(order.total, order.currency)
        holder.status.text = OrderStatus.label(context, order.status)
        holder.status.setBackgroundResource(
            when (order.status) {
                OrderStatus.NEW -> R.drawable.chip_orange
                OrderStatus.CONFIRMED -> R.drawable.chip_blue
                OrderStatus.PREPARING -> R.drawable.chip_purple
                OrderStatus.SHIPPED -> R.drawable.chip_teal
                OrderStatus.DELIVERED -> R.drawable.chip_green
                OrderStatus.CANCELLED -> R.drawable.chip_grey
                OrderStatus.RETURNED -> R.drawable.chip_grey
                else -> R.drawable.chip_grey
            },
        )
        holder.itemView.setOnClickListener { onClick(order) }
    }

    class Holder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val number: TextView = itemView.findViewById(R.id.order_number)
        val customer: TextView = itemView.findViewById(R.id.order_customer)
        val whenText: TextView = itemView.findViewById(R.id.order_when)
        val total: TextView = itemView.findViewById(R.id.order_total)
        val status: TextView = itemView.findViewById(R.id.order_status)
    }
}

class ProductsAdapter : RecyclerView.Adapter<ProductsAdapter.Holder>() {

    private val items = mutableListOf<ProductRow>()

    fun submit(rows: List<ProductRow>) {
        items.clear()
        items.addAll(rows)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder =
        Holder(
            LayoutInflater.from(parent.context)
                .inflate(R.layout.item_product, parent, false),
        )

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: Holder, position: Int) {
        val product = items[position]
        val context = holder.itemView.context
        holder.name.text = product.name
        holder.sku.text = product.sku.ifEmpty { product.slug }
        holder.price.text = formatMoney(product.price)
        val stockLabel =
            context.getString(R.string.products_stock_value, product.totalStock)
        holder.stock.text = stockLabel
        holder.stock.setBackgroundResource(
            if (product.totalStock > 0) R.drawable.chip_green else R.drawable.chip_red,
        )
        val variantsLabel =
            context.getString(R.string.products_variants_value, product.variantCount)
        holder.variants.text = variantsLabel
        holder.status.text =
            when (product.status) {
                "active" -> context.getString(R.string.product_status_active)
                "draft" -> context.getString(R.string.product_status_draft)
                "archived" -> context.getString(R.string.product_status_archived)
                else -> product.status
            }
    }

    class Holder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val name: TextView = itemView.findViewById(R.id.product_name)
        val sku: TextView = itemView.findViewById(R.id.product_sku)
        val price: TextView = itemView.findViewById(R.id.product_price)
        val stock: TextView = itemView.findViewById(R.id.product_stock)
        val variants: TextView = itemView.findViewById(R.id.product_variants)
        val status: TextView = itemView.findViewById(R.id.product_status)
    }
}

class NotificationsAdapter(private val onClick: (NotificationRow) -> Unit) :
    RecyclerView.Adapter<NotificationsAdapter.Holder>() {

    private val items = mutableListOf<NotificationRow>()
    private var readBefore: Long = 0

    fun submit(rows: List<NotificationRow>, readBeforeId: Long) {
        items.clear()
        items.addAll(rows)
        readBefore = readBeforeId
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder =
        Holder(
            LayoutInflater.from(parent.context)
                .inflate(R.layout.item_notification, parent, false),
        )

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: Holder, position: Int) {
        val row = items[position]
        holder.title.text = row.title
        holder.body.text = row.body
        holder.whenText.text = formatDateTime(row.createdAt)
        holder.unreadDot.visibility = if (row.id > readBefore) View.VISIBLE else View.GONE
        holder.itemView.setOnClickListener { onClick(row) }
    }

    class Holder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val title: TextView = itemView.findViewById(R.id.notification_title)
        val body: TextView = itemView.findViewById(R.id.notification_body)
        val whenText: TextView = itemView.findViewById(R.id.notification_when)
        val unreadDot: View = itemView.findViewById(R.id.notification_unread_dot)
    }
}

class OrderItemsAdapter : RecyclerView.Adapter<OrderItemsAdapter.Holder>() {

    private val items = mutableListOf<OrderItemRow>()

    fun submit(rows: List<OrderItemRow>) {
        items.clear()
        items.addAll(rows)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder =
        Holder(
            LayoutInflater.from(parent.context)
                .inflate(R.layout.item_order_item, parent, false),
        )

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: Holder, position: Int) {
        val item = items[position]
        holder.name.text = item.name
        val variant =
            listOf(item.size, item.color).filter { it.isNotBlank() }.joinToString(" / ")
        holder.variant.text = variant.ifEmpty { "—" }
        holder.quantity.text = "×${item.quantity}"
        holder.price.text = formatMoney(item.price * item.quantity)
    }

    class Holder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val name: TextView = itemView.findViewById(R.id.item_name)
        val variant: TextView = itemView.findViewById(R.id.item_variant)
        val quantity: TextView = itemView.findViewById(R.id.item_quantity)
        val price: TextView = itemView.findViewById(R.id.item_price)
    }
}

class NotesAdapter : RecyclerView.Adapter<NotesAdapter.Holder>() {

    private val items = mutableListOf<NoteRow>()

    fun submit(rows: List<NoteRow>) {
        items.clear()
        items.addAll(rows)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder =
        Holder(
            LayoutInflater.from(parent.context)
                .inflate(R.layout.item_note, parent, false),
        )

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: Holder, position: Int) {
        val note = items[position]
        holder.author.text =
            "${note.author} · ${formatDateTime(note.createdAt)}"
        holder.body.text = note.body
    }

    class Holder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val author: TextView = itemView.findViewById(R.id.note_author)
        val body: TextView = itemView.findViewById(R.id.note_body)
    }
}

class EventsAdapter : RecyclerView.Adapter<EventsAdapter.Holder>() {

    private val items = mutableListOf<EventRow>()

    fun submit(rows: List<EventRow>) {
        items.clear()
        items.addAll(rows)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder =
        Holder(
            LayoutInflater.from(parent.context)
                .inflate(R.layout.item_event, parent, false),
        )

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: Holder, position: Int) {
        val event = items[position]
        val context = holder.itemView.context
        holder.whenText.text = formatDateTime(event.createdAt)
        val kindLabel =
            when (event.kind) {
                "status" -> context.getString(R.string.event_kind_status)
                "payment" -> context.getString(R.string.event_kind_payment)
                "delivery" -> context.getString(R.string.event_kind_delivery)
                "stock" -> context.getString(R.string.event_kind_stock)
                "note" -> context.getString(R.string.event_kind_note)
                else -> event.kind
            }
        val from =
            when (event.kind) {
                "status" -> OrderStatus.label(context, event.fromValue)
                "delivery" -> DeliveryStatus.label(context, event.fromValue)
                else -> event.fromValue
            }
        val to =
            when (event.kind) {
                "status" -> OrderStatus.label(context, event.toValue)
                "delivery" -> DeliveryStatus.label(context, event.toValue)
                else -> event.toValue
            }
        holder.description.text = "$kindLabel: $from → $to"
        holder.actor.text = event.actor.ifEmpty { "—" }
    }

    class Holder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val whenText: TextView = itemView.findViewById(R.id.event_when)
        val description: TextView = itemView.findViewById(R.id.event_description)
        val actor: TextView = itemView.findViewById(R.id.event_actor)
    }
}
