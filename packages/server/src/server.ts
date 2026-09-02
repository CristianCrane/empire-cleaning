import express from "express";
import authRoutes from "./auth/routes.ts";
import quoteRoutes from "./quotes/routes.ts";
import loggingFormat from "./config/logging.ts";
import corsPolicy from "./config/cors.ts";
import cors from "cors";

const app = express();

// middleware
app.use(cors(corsPolicy));
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
