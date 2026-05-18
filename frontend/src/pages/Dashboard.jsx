import { useEffect, useState } from "react";

import OrderForm from "../components/OrderForm";
import OrderList from "../components/OrderList";

import api from "../services/api";

export default function Dashboard() {
    const [orders, setOrders] = useState([]);

    const loadOrders = async () => {
        const response = await api.get("/orders");

        setOrders(response.data);
    };

    useEffect(() => {
        loadOrders();

        const interval = setInterval(
            loadOrders,

            3000,
        );

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-gray-100 p-10">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-bold mb-8">Async Order Platform</h1>

                <OrderForm reload={loadOrders} />

                <OrderList orders={orders} />
            </div>
        </div>
    );
}
