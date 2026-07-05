require("dotenv").config();

const app = require("./app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

if (process.env.RUN_WORKER_INLINE === "true") {
  require("./src/workers/order.worker");
  console.log("Order worker running in-process (RUN_WORKER_INLINE=true)");
}
