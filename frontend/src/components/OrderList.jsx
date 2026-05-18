export default function OrderList({ orders }) {
    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">My Orders</h2>

            {orders.map((order) => (
                <div key={order.id} className="bg-white shadow p-4 rounded mb-4">
                    <p>
                        <span className="font-bold">Order: </span>

                        {order.id}
                    </p>

                    <p>
                        <span className="font-bold">Status: </span>

                        {order.status}
                    </p>

                    <p>
                        <span className="font-bold">Amount: </span>₹{order.amount}
                    </p>
                </div>
            ))}
        </div>
    );
}
