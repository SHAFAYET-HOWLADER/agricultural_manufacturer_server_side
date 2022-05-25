const express = require("express");
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
//---------middleware------------//
//user=dbUser
//pass=BfMewB4I9ZLigoJ1
app.use(cors());
app.use(express.json());
app.get('/', (req, res) => {
    res.send('hello world ! ');
})
const uri = `mongodb+srv://${process.env.toolsUser}:${process.env.toolsPass}@cluster0.ipzen.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
//---------------verify jwt----------------//
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'unAuthorized access' })
    }
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden' })
        }
        req.decoded = decoded;
        next();
    });
}
async function run() {
    try {
        await client.connect();
        const toolsCollection = client.db("toolsProducer").collection("tools");
        const userCollection = client.db("toolsProducer").collection("users");
        const ordersCollection = client.db("toolsProducer").collection("orders");
        const paymentCollection = client.db("toolsProducer").collection("payment");
        const reviewsCollection = client.db("toolsProducer").collection("reviews");
        //find reviews collection from db
        app.get('/reviews', async (req,res)=>{
          const query = {};
          const result = await reviewsCollection.find(query).toArray();
          res.send(result)
        })
        app.get('/orders', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const orders = await ordersCollection.find(query).toArray();
            res.send(orders);
        })
          //delete order
          app.delete('/orders/:id',async (req,res)=>{
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const result = await ordersCollection.deleteOne(query);
            res.send(result);
        })
        //get selected product for payment
        app.get('/orders/:id',verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await ordersCollection.findOne(query);
            res.send(order)
        })
        //post user's orders information
        app.post('/orders', async (req, res) => {
            const customer = req.body;
            const query = {
                productName: customer.product,
                userName: customer.name,
                userPhone: customer.phone
            }
            const exists = await ordersCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, orders: exists });
            }
            const result = await ordersCollection.insertOne(customer);
            return res.send({ success: true, result });
        })

        //find one
        app.get('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const tool = await toolsCollection.findOne(query);
            res.send(tool);
        })
        //paymentIntent
        app.post('/create-payment-intent', verifyJWT, async (req,res)=>{
            const product = req.body;
            const price = product.price;
            const amount = price*100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types:['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })
        app.patch('/orders/:id',  verifyJWT, async (req,res)=>{
             const id = req.params.id;
             const payment = req.body;
             const filter = {_id: ObjectId(id)};
             const updateDoc = {
                 $set: {
                     paid: true,
                     transactionId: payment.transactionId
                 }
             }
             const result = await paymentCollection.insertOne(payment);
             const updatedOrder = await ordersCollection.updateOne(filter,updateDoc);
             res.send(updateDoc);
        })
        //find all tools 
        app.get('/tools', async (req, res) => {
            const query = {};
            const cursor = toolsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })
        //review post
        app.post('/review', verifyJWT, async (req,res)=>{
            const newReview = req.body;
            const result = await reviewsCollection.insertOne(newReview);
            res.send(result);
        })
        //create user using put method
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            }
            const result = await userCollection.updateOne(filter, updateDoc, options)
            const accessToken = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '6d',
            })
            res.send({ result, accessToken });
        })
    }
    finally {
        // await client.close();
    }
}
run().catch(console.dir);
app.listen(port, () => {
    console.log('Backend server is running', port);
})