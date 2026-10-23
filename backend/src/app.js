const express = require("express");
const helmet = require("helmet");
const { getTrustProxyHops } = require("./config/environment");
const notFound = require("./middlewares/not-found");
const errorHandler = require("./middlewares/error-handler");

const app = express();

app.set("trust proxy", getTrustProxyHops());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "upgrade-insecure-requests": app.get("env") === "production" ? [] : null
      }
    }
  })
);
app.use(express.json({ limit: "100kb" }));

const healthRouter = require("./routes/health.routes");
const productRouter = require("./modules/products/product.routes");
const catalogRouter = require("./modules/catalog/catalog.routes");
const inventoryRouter = require("./modules/inventory/inventory.routes");
const supplierRouter = require("./modules/suppliers/supplier.routes");
const authRouter = require("./modules/auth/auth.routes");
const receiptRouter = require("./modules/receipts/receipt.routes");
const customerRouter = require("./modules/customers/customer.routes");
const saleRouter = require("./modules/sales/sale.routes");

app.use("/api", healthRouter);
app.use("/api", catalogRouter);
app.use("/api/products", productRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/suppliers", supplierRouter);
app.use("/api/auth", authRouter);
app.use("/api/receipts", receiptRouter);
app.use("/api/customers", customerRouter);
app.use("/api/sales", saleRouter);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
