import express from "express";
import authRoutes from "./auth/routes.ts";
import quoteRoutes from "./quotes/routes.ts";
import loggingFormat from "./config/logging.ts";

const app = express();

// middleware
app.use(loggingFormat);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes
app.get("/health", (req, res) => {
  res
    .json({
      status: "ok",
    })
    .status(200);
});

app.use("/api/auth", authRoutes);
app.use("/api/quotes", quoteRoutes);

export { app };
