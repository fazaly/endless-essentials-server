const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// Step- 01 (jwt)
const jwt = require('jsonwebtoken');
require('dotenv').config();

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
        const userCollection = client.db('EndlessEssentials').collection('users');

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

        app.post('/users', async (req, res) => {
            const query = req.body
            const result = await userCollection.insertOne(query)
            res.send(result)
        });

        app.get('/myorder', async (req, res) => {
            let query = {}
            if (req.query.email) {
                query = {
                    email: req.query.email
                }
            }
            const result = await bookingsCollection.find(query).toArray()
            res.send(result);
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