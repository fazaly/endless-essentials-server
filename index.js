const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// Step- 01 (jwt)
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Stripe secret key
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());


// Mongodb
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.rzk36ti.mongodb.net/?retryWrites=true&w=majority`;
// console.log(uri);

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// Step- 06 (jwt)
function verifyJWT(req, res, next) {

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })
}


async function run(){
    try{
        const productsCollection = client.db('EndlessEssentials').collection('products');
        const categoryCollection = client.db('EndlessEssentials').collection('category');
        const bookingsCollection = client.db('EndlessEssentials').collection('bookings');
        const usersCollection = client.db('EndlessEssentials').collection('users');
        const addProductsCollection = client.db('EndlessEssentials').collection('addProducts');
        const paymentsCollection = client.db('EndlessEssentials').collection('payments');
        const advertiseCollection = client.db('EndlessEssentials').collection('advertise');


        // Note: make sure you use verifyAdmin after verifyJWT
        const verifyAdmin = async(req, res, next ) => {
            // console.log('inside verifyAdmin', req.decoded.email);
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        // 
        app.get('/products', async(req, res) => {
            const query = {}
            const result = await productsCollection.find(query).toArray();
            res.send(result);
        });

        // 
        app.get('/category/:name', async(req, res) => {
            const name = req.params.name;
            const filter = {name}
            const result = await categoryCollection.find(filter).toArray();
            res.send(result);
        });

        app.get('/allCategory', async (req, res) => {
            const query = {}
            const result = await categoryCollection.find(query).toArray()
            res.send(result)
        })

        // read bookings from mongodb database
        app.get('/categories/:id', async(req, res) => {
            const id = req.params.id;
            const filter = {_id: ObjectId(id)}
            const result = await categoryCollection.findOne(filter);
            res.send(result);
        });


        app.post('/bookings', async (req, res) => {
            const query = req.body
            const result = await bookingsCollection.insertOne(query)
            res.send(result)
        });

        // read bookings on mongodb database
        app.get('/bookings', verifyJWT, async(req, res) => {
            const email = req.query.email;

            // Step- 05 (jwt)
            // console.log('token', req.headers.authorization);

            // Step- 07 (jwt)
            const decodedEmail = req.decoded.email;
            // console.log(decodedEmail);

            if(email !== decodedEmail){
                return res.status(403).send({message: 'forbidden access'});
            }

            const query = {email: email}
            const bookings = await bookingsCollection.find(query).toArray();
            res.send(bookings);
        });

        app.get('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const result = await bookingsCollection.findOne(filter)
            res.send(result)
        });

        // create stripe payment method for mongodb database
        app.post('/create-payment-intent', async(req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                'payment_method_types': [
                    'card'
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        // create payment database for mongodb database
        app.post('/payments', async(req,res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);

            // update payment to bookingsCollection
            const id = payment.bookingId;
            const filter = {_id: ObjectId(id)}
            const updateDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updatedResult = await bookingsCollection.updateOne(filter, updateDoc)
            res.send(result);
        });

        app.post('/users', async (req, res) => {
            const query = req.body
            const result = await usersCollection.insertOne(query)
            res.send(result);
        });


        app.get('/users', async (req, res) => {
            const query = {};
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        });

        // User info from mongodb database
        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        })

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            console.log(email);
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        })

        app.put('/users/admin/:id', verifyJWT, verifyAdmin,  async(req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        app.get('/myOrder', async (req, res) => {
            let query = {}
            if (req.query.email) {
                query = {
                    email: req.query.email
                }
            }
            const result = await bookingsCollection.find(query).toArray()
            res.send(result);
        });

        app.post('/addProducts', async (req, res) => {
            const query = req.body;
            const result = await addProductsCollection.insertOne(query)
            res.send(result)
        });

        app.get('/myProducts', verifyJWT, async (req, res) => {
            let query = {}
            if (req.query.email) {
                query = {
                    email: req.query.email
                }
            }
            const result = await addProductsCollection.find(query).toArray()
            res.send(result)
        });

        app.get('/myProducts/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await addProductsCollection.findOne(query)
            res.send(result)
        });

        // Products info from mongodb database
        app.delete('/myProducts/:id', verifyJWT, async(req, res) => {
            const id = req.params.id;
            const filter = {_id: ObjectId(id)}
            const result = await addProductsCollection.deleteOne(filter);
            res.send(result);
        });

        app.post('/advertise', async (req, res) => {
            const query = req.body;
            const users = await advertiseCollection.insertOne(query)
            res.send(users)
        });

        app.get('/advertise', async(req, res) => {
            const query = {}
            const advertise = await advertiseCollection.find(query).toArray();
            res.send(advertise);
        });

        // Step- 02 (jwt)
        app.get('/jwt', async(req, res) => {
            const email = req.query.email;
            const query = {email: email}
            const user = await usersCollection.findOne(query);
            if(user?.email){
                const token = jwt.sign({email}, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' });
                return res.send({accessToken: token});
            }
            // console.log(user);
            res.status(403).send({accessToken: ''})
        });
    }
    finally{

    }
}
run().catch(console.log)

app.get('/', async(req, res) => {
    res.send('Endless Essentials server is running')
});

app.listen(port, () => console.log(`Endless Essentials server running on ${port}`));