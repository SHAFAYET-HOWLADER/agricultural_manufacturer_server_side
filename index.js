const express = require("express");
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
//---------middleware------------//
app.use(cors());
app.use(express.json());
app.get('/', (req, res) => {
    res.send('hello worlds ! ');
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
        const profileCollection = client.db("toolsProducer").collection("profile");
        //---------------verify admin----------------//
        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                res.status(403).send({ message: 'forbidden' })
            }
        }
        //----------post profile info in db--------------//
        app.post('/profile', async (req, res) => {
            const userInfo = req.body;
            const profile = await profileCollection.insertOne(userInfo)
            res.send(profile);
        })
        //----------find reviews collection from db------------//
        app.get('/profile', async (req, res) => {
            const query = {};
            const result = await profileCollection.find(query).toArray();
            res.send(result)
        })
        //--------------update profile----------------//
        app.put('/profile/:email', async (req, res) => {
            const email = req.params.email;
            const updatedProfile = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updatedDoc = {
                $set: updatedProfile,
            };
            const result = await profileCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })
        //---------------find reviews collection from db-----------------//
        app.get('/reviews', async (req, res) => {
            const query = {};
            const result = await reviewsCollection.find(query).toArray();
            res.send(result)
        })
        app.get('/orders', async (req,res)=>{
            const query = {};
            const result = await ordersCollection.find(query).toArray();
            res.send(result)
        })
        app.get('/orders', async (req,res)=>{
            const email = req.query.email;
            const filter = {email:email};
            const result = await ordersCollection.find(filter).toArray();
            res.send(result);
        })
        app.patch('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updateDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const result = await paymentCollection.insertOne(payment);
            const updatedOrder = await ordersCollection.updateOne(filter, updateDoc);
            res.send(updateDoc);
        })
        //-------------delete order-------------------//
        app.delete('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await ordersCollection.deleteOne(query);
            res.send(result);
        })
        //-----------------post user's orders information-----------------//
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

        //----------------find one----------------------//
        app.get('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const tool = await toolsCollection.findOne(query);
            res.send(tool);
        })
        //----------------paymentIntent----------------------//
        app.post('/create-payment-intent', async (req, res) => {
            const product = req.body;
            const price = product.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        //----------------find all tools---------------//
        app.get('/tools', async (req, res) => {
            const query = {};
            const cursor = toolsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })
        //-----------------delete tools/products-------------------//
        app.delete('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await toolsCollection.deleteOne(query);
            res.send(result);
        })

        //------------------post tools in db-------------------// 
        app.post('/tools', async (req, res) => {
            const newTools = req.body;
            const result = await toolsCollection.insertOne(newTools);
            res.send(result);
        })
        //review post
        app.post('/review', async (req, res) => {
            const newReview = req.body;
            const result = await reviewsCollection.insertOne(newReview);
            res.send(result);
        })
        //-----------------get all user--------------------//
        app.get('/user', async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        })
        //------------------delete user--------------------// 
        app.delete('/user/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const users = await userCollection.deleteOne(query);
            res.send(users);
        })
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email })
            const isAdmin = user.role === 'admin'
            res.send({ admin: isAdmin });
        })
        //---------------make admin route-----------------//
        app.put('/user/admin/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            }
            const result = await userCollection.updateOne(filter, updateDoc)
            res.send(result);
        })
        //-----------------create user using put method--------------------//
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
