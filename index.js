const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors())
app.use(express.json());

// verify JWT token
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;

    if(!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    } 
        
    // bearer token
    const token = authorization.split(' ')[1];  
        
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if(err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' });
        }
        req.decoded = decoded;
        next();
    })
}

const { MongoClient, ServerApiVersion } = require('mongodb');
const { ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.oexcdfc.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // database collections
    // const courses = client.db("eduMall").collection("courses");
    const usersCollection = client.db("eduMall").collection("users");
    const popularCollection = client.db("eduMall").collection("popular");
    const classCollection = client.db("eduMall").collection("classes");
    const addClassCollection = client.db("eduMall").collection("addClasses");
    const enrollCollection = client.db("eduMall").collection("enroll");

    // generate client secret
    app.post('/create-payment-intent', async (req, res) => {
        const { price } = req.body;
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

    app.post('/jwt', (req, res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
        res.send({ token });
    })

    // app.get('/courses', async(req, res) => {
    //     const result = await courses.find().toArray();
    //     res.send(result);
    // })

    // app.get('/courses/:id', async(req, res) => {
    //     const id = req.params.id;
    //     const query = { _id: new ObjectId(id)};
    //     const result = await courses.findOne(query);
    //     res.send(result);
    // })

    // user api
    app.get('/users', async (req, res) => {
        const result = await usersCollection.find().toArray();
        res.send(result);
    })

    // get instructor
    app.get('/users/instructor', async (req, res) => {
        const result = await usersCollection.find({ role: 'Instructor'}).toArray();
        res.send(result);
    })

    // all users api
    app.post('/users', async (req, res) => {
        const user = req.body;
        const query = { email : user.email };
        const existingUser = await usersCollection.findOne(query);

        if(existingUser) {
            return res.send({ message: 'User Already Exists' });
        }
        const result = await usersCollection.insertOne(user);
        res.send(result);
    })

    // users admin role
    app.patch('/users/admin/:id', async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
            $set: {
                role: 'Admin',
            },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
    })

    // users instructor role
    app.patch('/users/instructor/:id', async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
            $set: {
                role: 'Instructor',
            },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
    })

    // verify admin
    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
        const email = req.params.email;

        if(req.decoded.email !== email) {
            res.send({ admin: false })
        }

        const query = { email: email};
        const user = await usersCollection.findOne(query)
        const result = { admin:user?.role === 'Admin' }
        res.send(result)
    })

    // instructor
    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
        const email = req.params.email;

        if(req.decoded.email !== email) {
            res.send({ instructor: false })
        }

        const query = { email: email};
        const user = await usersCollection.findOne(query)
        const result = { instructor:user?.role === 'Instructor' }
        res.send(result)
    })

    // user role
    app.get('/users/role/:email', async (req, res) => { 
        const email = req.params.email;
        const query = { email: email };
        const result = await usersCollection.findOne(query);
        const role = result?.role;
        res.send({ role });
    })

    // get all popular instructor and classes
        // this method worked for only fake data api
        // now, this method don't used
        app.get('/popular', async (req, res) => {
            const result = await popularCollection.find().toArray();
            res.send(result);
        })

        // post all classes
        app.post('/addClass/instructor', verifyJWT, async (req, res) => {
            const data = req.body;
            const result = await addClassCollection.insertOne(data);
            res.send(result);
        })

        // adding class by instructor. find the instructor email
        app.get('/addClass/instructor/:email', async (req, res) => { 
            const email = req.params.email;
            
            const query = { instructor_mail: email };
            const result = await addClassCollection.find(query).toArray();
            res.send(result);
        })

        // manage all class
        app.get('/manageClass', async (req, res) => {
            const result = await addClassCollection.find().toArray();
            res.send(result);
        })

        // approve class
        app.patch('/actionBtn/:id', async (req, res) => {
            const status = req.body.action;
            const addAction = { 
                $set: {
                    status: status
                }
            }
            const id = { _id: new ObjectId(req.params.id)}
            const result = await addClassCollection.updateOne(id, addAction);
            res.send(result);
        })

        // get all class
        app.get('/classes', async (req, res) => {
            const result = await addClassCollection.find().toArray();
            res.send(result);
        })

        // get class after approve class
        app.get('/classes/approveClass', async (req, res) => {
            const result = await addClassCollection.find({ status: 'approve'}).toArray();
            res.send(result);
        })

        // class collection api
        app.get('/classes/student/:email', async (req, res) => {
            const email = req.params.email;
            
            if(!email) {
                res.send([]);
            }

            // const decodedEmail = req.decoded.email;
            // if(email !== decodedEmail) {
            //     return res.status(403).send({ error: true, message: 'forbidden access' });
            // }

            const query = { email: email };
            const result = await classCollection.find(query).toArray();
            res.send(result);
        })

        // select class
        app.post('/classes', async (req, res) => {
            const item = req.body;
            const result = await classCollection.insertOne(item);
            res.send(result);
        })

        // delete single class
        app.delete('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await classCollection.deleteOne(query);
            res.send(result);
        })

        app.post('/enroll/:email', async (req, res) => {
            const user = req.body;
            const query = req.params.email;
            const result = await enrollCollection.insertMany(user);
            const deleteResult = await classCollection.deleteMany({email: query});
            res.send({ result, deleteResult });
        })

        app.get('/enroll/:email', async (req, res) => {
            const query = req.params.email;
            const result = await enrollCollection.findOne({ email: query });
            res.send(result);
        })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('EduMall is running')
})

app.listen(port, () => {
    console.log(`EduMall is running on port: ${port}`);
})