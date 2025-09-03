require('dotenv').config();
require('express-async-errors');
//express
const express = require('express');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const cors = require('cors');
const app = express();


// rest of the packages
const morgan = require('morgan');

//database
const connectDB = require('./config/connectDB');

//routers
const authRouter = require('./routers/auth');
const seoRouter = require('./routers/seo');

//midlleware
const notFoundMiddleware = require('./middleware/not-found')
const erorHandlerMiddleware = require('./middleware/eror-handler')

app.use(cors({
    origin: true,
    credentials: true,
    exposedHeaders: ['Content-Type', 'Authorization']
}));

// For preflight OPTIONS requests
app.options('*', cors());

app.use(helmet());
app.use(mongoSanitize());

//app
app.use(morgan('tiny'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//routes
app.use('/v1/auth', authRouter);
app.use('/v1/seo', seoRouter);

app.use(notFoundMiddleware);
app.use(erorHandlerMiddleware);

const port = process.env.PORT || 3040

const start = async () => {
    try {
        // Only connect to MongoDB if MONGO_URL is provided and valid
        if (process.env.MONGO_URL && process.env.MONGO_URL !== 'your_mongodb_url_here' && process.env.MONGO_URL.startsWith('mongodb')) {
            await connectDB(process.env.MONGO_URL);
            console.log(`MongoDB Connection Successful`);
        } else {
            console.log('MongoDB connection skipped - MONGO_URL not configured');
        }
        
        app.listen(port, () => {
            console.log(`App started on port ${port} : ${process.env.NODE_ENV}`);
        });
    } catch (error) {
        console.log(error);
    }
};

start();