import { useState } from "react";
import api from "../services/api";
import { useNavigate, Link } from "react-router-dom";

export default function Signup() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const navigate = useNavigate();

    const signup = async () => {
        try {
            await api.post(
                "/auth/signup",

                {
                    name,
                    email,
                    password,
                },
            );

            navigate("/");
        } catch {
            alert("Signup Failed");
        }
    };

    return (
        <div className="min-h-screen flex justify-center items-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-lg w-96">
                <h1 className="text-3xl font-bold mb-6 text-center">Create Account</h1>

                <input
                    className="w-full border p-3 rounded mb-4"
                    placeholder="Name"
                    onChange={(e) => setName(e.target.value)}
                />

                <input
                    className="w-full border p-3 rounded mb-4"
                    placeholder="Email"
                    onChange={(e) => setEmail(e.target.value)}
                />

                <input
                    className="w-full border p-3 rounded mb-4"
                    type="password"
                    placeholder="Password"
                    onChange={(e) => setPassword(e.target.value)}
                />

                <button
                    className="w-full bg-black text-white p-3 rounded"
                    onClick={signup}
                >
                    Signup
                </button>

                <p className="mt-4 text-center">
                    Already have account?
                    <Link to="/" className="text-blue-600">
                        Login
                    </Link>
                </p>
            </div>
        </div>
    );
}
