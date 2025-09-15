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
const instrumentRouter = require('./routers/instrument');
const contactRouter = require('./routers/contact');
const settingsRouter = require('./routers/settings');
const blogRouter = require('./routers/blog');
const blogCategoryRouter = require('./routers/blogCategory');
const messageRouter = require('./routers/message');
const notificationRouter = require('./routers/notification');
const { router: sseRouter } = require('./routers/sse');

//midlleware
const notFoundMiddleware = require('./middleware/not-found')
const erorHandlerMiddleware = require('./middleware/eror-handler')

app.use(cors({
    origin: [
        'http://localhost:3000',
        'https://bandbul.vercel.app',
        'https://bandbul-nextjs.vercel.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Type', 'Authorization']
}));

// For preflight OPTIONS requests
app.options('*', cors({
    origin: [
        'http://localhost:3000',
        'https://bandbul.vercel.app',
        'https://bandbul-nextjs.vercel.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(helmet());
app.use(mongoSanitize());

//app
app.use(morgan('tiny'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

//routes
app.use('/v1/auth', authRouter);
app.use('/v1/listings', listingRouter);
app.use('/v1/listing-categories', listingCategoryRouter);
app.use('/v1/instruments', instrumentRouter);
app.use('/v1/contacts', contactRouter);
app.use('/v1/settings', settingsRouter);
app.use('/v1/blogs', blogRouter);
app.use('/v1/blog-categories', blogCategoryRouter);
app.use('/v1/messages', messageRouter);
app.use('/v1/notifications', notificationRouter);
app.use('/sse', sseRouter);

app.use(notFoundMiddleware);
app.use(erorHandlerMiddleware);

const port = process.env.PORT || 3040

const start = async () => {
    try {
        // Only connect to MongoDB if MONGO_URL is provided and valid
        if (process.env.MONGO_URL && process.env.MONGO_URL !== 'your_mongodb_url_here' && process.env.MONGO_URL.startsWith('mongodb')) {
            await connectDB(process.env.MONGO_URL);
        } else {
        }
        
        const server = app.listen(port, () => {
            console.log(`MongoDb Connection Successful,App started on port ${port} : ${process.env.NODE_ENV}`);
        });

        // Initialize WebSocket server only in development
        if (process.env.NODE_ENV !== 'production') {
            const SocketServer = require('./websocket/socketServer');
            const socketServer = new SocketServer(server);
            
            // Make socket server accessible globally
            app.set('socketServer', socketServer);
            global.socketServer = socketServer;
        } else {
            // In production, set socketServer to null
            app.set('socketServer', null);
            global.socketServer = null;
        }
        
        
    } catch (error) {
    }
};

start();