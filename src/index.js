import mongoose from 'mongoose';
import connectDB from "./db/index.js";
import dotenv from "dotenv";
import { application } from 'express';
import app from "./app.js";

dotenv.config(
    {
        path: './env'
    }
);

connectDB().then(
    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running on port ${process.env.PORT || 8000}`);   

        app.on('error',(error) => {
            console.log("Error occurred: ", error);
            throw error;
        })
    }),
).catch((err) => {
    console.log("MongoDB connection failed: ", err);
})