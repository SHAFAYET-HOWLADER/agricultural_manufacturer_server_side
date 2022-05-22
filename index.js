const express = require("express");
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
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
async function run() {
    try {
        await client.connect();
        const toolsCollection = client.db("toolsProducer").collection("tools");
        //finds tools 
        app.get('/tools', async (req, res) => {
            const query = {};
            const cursor = toolsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
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