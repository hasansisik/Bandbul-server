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
const listingRouter = require('./routers/listing');
const listingCategoryRouter = require('./routers/listingCategory');
const contactRouter = require('./routers/contact');
const settingsRouter = require('./routers/settings');
const blogRouter = require('./routers/blog');
const blogCategoryRouter = require('./routers/blogCategory');
const messageRouter = require('./routers/message');

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
app.use('/v1/listings', listingRouter);
app.use('/v1/listing-categories', listingCategoryRouter);
app.use('/v1/contacts', contactRouter);
app.use('/v1/settings', settingsRouter);
app.use('/v1/blogs', blogRouter);
app.use('/v1/blog-categories', blogCategoryRouter);
app.use('/v1/messages', messageRouter);

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
        
        const server = app.listen(port, () => {
            console.log(`App started on port ${port} : ${process.env.NODE_ENV}`);
        });

        // Initialize WebSocket server
        const SocketServer = require('./websocket/socketServer');
        const socketServer = new SocketServer(server);
        
        // Make socket server accessible globally
        app.set('socketServer', socketServer);
        global.socketServer = socketServer;
        
        console.log('WebSocket server initialized');
        
    } catch (error) {
        console.log(error);
    }
};

start();