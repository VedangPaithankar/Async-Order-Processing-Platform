import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../services/api";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const { login } = useContext(AuthContext);

    const navigate = useNavigate();

    const handleLogin = async () => {
        try {
            const response = await api.post(
                "/auth/login",

                {
                    email,
                    password,
                },
            );

            login(response.data.token);

            navigate("/dashboard");
        } catch {
            alert("Invalid Credentials");
        }
    };

    return (
        <div className="min-h-screen flex justify-center items-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-lg w-96">
                <h1 className="text-3xl font-bold mb-6 text-center">
                    Async Order Platform
                </h1>

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
                    onClick={handleLogin}
                >
                    Login
                </button>

                <p className="mt-4 text-center">
                    No account?
                    <Link to="/signup" className="text-blue-600">
                        Signup
                    </Link>
                </p>
            </div>
        </div>
    );
}
