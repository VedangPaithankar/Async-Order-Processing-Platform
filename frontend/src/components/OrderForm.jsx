import { useState } from "react";
import api from "../services/api";

export default function OrderForm({ reload }) {
    const [amount, setAmount] = useState("");

    const submit = async () => {
        await api.post(
            "/orders",

            {
                amount: Number(amount),
            },
        );

        setAmount("");

        reload();
    };

    return (
        <div className="mb-6">
            <input
                className="border p-3 rounded w-64 mr-2"
                placeholder="Order Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
            />

            <button className="bg-black text-white p-3 rounded" onClick={submit}>
                Place Order
            </button>
        </div>
    );
}
