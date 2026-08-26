import express from "express";

const app = express();

app.get("/health", (req, res) => {
  res
    .json({
      status: "ok",
    })
    .status(200);
});

export { app };
